"""Set-Transformer actor-critic for the XMage env, all-cards version (batch-native).

Card tokens = learned projection of frozen text embedding (384->32)
            + structured features (14: mv, colors, types)
            + runtime features (6: tapped, p, h, dmg, counters, is_creature)
            + learned hash embedding (16) for unknown names (tokens, special cards)

One decision per prompt:
- priority: pick an action from `acts` (or pass)
- attackers: binary per candidate creature
- blockers: per candidate creature, block one attacker or none

Batched code path: transitions are grouped by exact shape (no padding), so the
same parameter math runs with a batch dimension. apply_encoded(e) ==
apply_batched([e])[0], used by collection with B=1.
"""
from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F

from .card_features import CardTable, HASH_BUCKETS

STEPS = [
    "Untap", "Upkeep", "Draw", "Precombat Main", "Begin Combat",
    "Declare Attackers", "Declare Blockers", "End Combat", "Postcombat Main",
    "End", "Cleanup",
]
STEP_ID = {s: i for i, s in enumerate(STEPS)}
N_STEP = len(STEPS) + 1  # + other

T_LAND = 16
T_CREATURE = 2

D = 32
TEXT_PROJ_D = 32
HASH_D = 16
RT_D = 6
TOKEN_D = TEXT_PROJ_D + CardTable.STRUCT_D + RT_D + HASH_D  # 68
HEAD_EXTRA = 1  # kind bit for acts, can bit for combat cands, 1.0 for attackers
SCALARS_D = 11 + N_STEP + 3


def struct_from_obs(obj: dict) -> list[float]:
    """Same 14-dim layout as CardTable: [mv/10, 5 color bits, 8 type bits]."""
    v = [0.0] * CardTable.STRUCT_D
    v[0] = min(obj.get("mv", 0), 10) / 10.0
    co = obj.get("co", 0)
    for i in range(5):
        v[1 + i] = 1.0 if (co >> i) & 1 else 0.0
    ty = obj.get("ty", 0)
    for i in range(8):
        v[6 + i] = 1.0 if (ty >> i) & 1 else 0.0
    return v


def runtime_from_obs(obj: dict) -> list[float]:
    return [
        obj.get("t", 0),
        obj.get("p", 0) / 5.0,
        obj.get("h", 0) / 5.0,
        obj.get("dmg", 0) / 5.0,
        obj.get("cnt", 0) / 5.0,
        1.0 if (obj.get("ty", 0) & T_CREATURE) else 0.0,
    ]


def enc_scalars(obs: dict) -> torch.Tensor:
    me, op = obs["me"], obs["op"]
    step = STEP_ID.get(obs["step"], len(STEPS))
    prompt = {"priority": 0, "attackers": 1, "blockers": 2}[obs["prompt"]]
    return torch.tensor([
        me["life"] / 20.0, me["lib"] / 40.0, len(me.get("hand", [])) / 7.0, len(me["gy"]) / 40.0,
        op["life"] / 20.0, op["lib"] / 40.0, op.get("handCount", 0) / 7.0, len(op["gy"]) / 40.0,
        obs["turn"] / 30.0, obs.get("stack", 0) / 3.0,
        1.0 if obs.get("active") == obs["seat"] else 0.0,
        *[1.0 if step == i else 0.0 for i in range(N_STEP)],
        *[1.0 if prompt == i else 0.0 for i in range(3)],
    ], dtype=torch.float32)


class SetEncoder(nn.Module):
    """One attention block + attention pooling over a set of tokens. Batch-native."""

    def __init__(self, in_dim: int, d: int = D, heads: int = 2):
        super().__init__()
        self.proj = nn.Linear(in_dim, d)
        self.attn = nn.MultiheadAttention(d, heads, batch_first=True)
        self.norm1 = nn.LayerNorm(d)
        self.ff = nn.Sequential(nn.Linear(d, 2 * d), nn.ReLU(), nn.Linear(2 * d, d))
        self.norm2 = nn.LayerNorm(d)
        self.query = nn.Parameter(torch.randn(1, 1, d) * 0.5)
        self.pool = nn.MultiheadAttention(d, heads, batch_first=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x [B, n, in] -> [B, d]. n may be 0."""
        b = x.size(0)
        if x.size(1) == 0:
            return torch.zeros(b, self.proj.out_features, device=x.device)
        h = self.proj(x)
        a, _ = self.attn(h, h, h, need_weights=False)
        h = self.norm1(h + a)
        h = self.norm2(h + self.ff(h))
        q = self.query.expand(b, -1, -1)
        p, _ = self.pool(q, h, h, need_weights=False)
        return p.squeeze(1)


def group_key(e: dict):
    head = e["head"]
    base = (head, e["hand"][0].size(0), e["my"][0].size(0), e["op"][0].size(0))
    if head == "priority":
        return base + (e["cand"][0].size(0),)
    if head == "attackers":
        return base + (e["cand"][0].size(0),)
    return base + (e["cand"][0].size(0), e["atk"][0].size(0), e["n_opts"])


def group_indices(encs: list[dict]) -> dict:
    groups: dict = {}
    for i, e in enumerate(encs):
        groups.setdefault(group_key(e), []).append(i)
    return groups


def _stack4(groups) -> tuple:
    return tuple(torch.stack([g[k] for g in groups]) for k in range(4))


def stack_enc_group(es: list[dict]) -> dict:
    """Stack per-obs encodings that share the same shape key."""
    e0 = es[0]
    be = {
        "head": e0["head"],
        "hand": _stack4([e["hand"] for e in es]),
        "my": _stack4([e["my"] for e in es]),
        "op": _stack4([e["op"] for e in es]),
        "scalars": torch.stack([e["scalars"] for e in es]),
    }
    if e0["head"] == "priority":
        be["cand"] = _stack4([e["cand"] for e in es])
        be["kind"] = torch.stack([e["kind"] for e in es])
    elif e0["head"] == "attackers":
        be["cand"] = _stack4([e["cand"] for e in es])
        be["can"] = torch.stack([e["can"] for e in es])
    else:
        be["cand"] = _stack4([e["cand"] for e in es])
        be["atk"] = _stack4([e["atk"] for e in es])
        ncb = e0["n_opts"] - 1
        cb_pad = torch.full((len(es), e0["cand"][0].size(0), ncb), -1, dtype=torch.long)
        for i, e in enumerate(es):
            for j, cb in enumerate(e["cb"]):
                for k, idx in enumerate(cb):
                    cb_pad[i, j, k] = idx
        be["cb"] = cb_pad
        be["n_opts"] = e0["n_opts"]
    return be


def stack_actions(actions: list, head: str) -> torch.Tensor:
    if head == "priority":
        return torch.tensor([int(a) for a in actions], dtype=torch.long)
    if head == "attackers":
        return torch.stack([torch.as_tensor(a, dtype=torch.long) for a in actions])
    return torch.tensor([[int(x) for x in a] for a in actions], dtype=torch.long)


class Net(nn.Module):
    def __init__(self, table: CardTable):
        super().__init__()
        self.table = table
        self.text_proj = nn.Linear(CardTable.TEXT_D, TEXT_PROJ_D)
        self.hash_emb = nn.Embedding(HASH_BUCKETS, HASH_D)
        self.hand_enc = SetEncoder(TOKEN_D)
        self.bf_enc = SetEncoder(TOKEN_D)
        self.trunk = nn.Sequential(
            nn.Linear(3 * D + SCALARS_D, 128), nn.ReLU(),
            nn.Linear(128, 128), nn.ReLU(),
        )
        self.value = nn.Linear(128, 1)
        self.action_proj = nn.Sequential(nn.Linear(128, 64), nn.ReLU())
        self.cand_proj = nn.Sequential(nn.Linear(TOKEN_D + HEAD_EXTRA, 64), nn.ReLU())
        self.combat_proj = nn.Sequential(nn.Linear(TOKEN_D + HEAD_EXTRA, 64), nn.ReLU())
        self.pass_emb = nn.Parameter(torch.randn(1, TOKEN_D + HEAD_EXTRA) * 0.1)

    # ---------- preencode: raw tensors, cacheable, no parameters ----------

    def _name_group(self, names: list[str]):
        text, struct, hashes = self.table.lookup(names)
        n = len(names)
        return (text, struct, torch.zeros(n, RT_D), hashes)

    def _perm_group(self, perms: list[dict]):
        names = [p["n"] for p in perms]
        text, _, hashes = self.table.lookup(names)
        struct = torch.tensor([struct_from_obs(p) for p in perms], dtype=torch.float32) if perms else torch.zeros(0, CardTable.STRUCT_D)
        rt = torch.tensor([runtime_from_obs(p) for p in perms], dtype=torch.float32) if perms else torch.zeros(0, RT_D)
        return (text, struct, rt, hashes)

    def preencode(self, obs: dict) -> dict:
        e = {"head": obs["prompt"], "scalars": enc_scalars(obs)}
        e["hand"] = self._name_group(obs["me"].get("hand", []))
        e["my"] = self._perm_group(obs["me"]["bf"])
        e["op"] = self._perm_group(obs["op"]["bf"])
        if e["head"] == "priority":
            acts = obs.get("acts", [])
            e["cand"] = self._name_group([a["n"] for a in acts])
            e["kind"] = torch.tensor([1.0 if a["k"] == "cast" else 0.0 for a in acts],
                                     dtype=torch.float32).unsqueeze(1) if acts else torch.zeros(0, 1)
        elif e["head"] == "attackers":
            cands = obs.get("cands", [])
            e["cand"] = self._perm_group(cands)
            e["can"] = torch.tensor([c["can"] for c in cands], dtype=torch.float32).unsqueeze(1) if cands else torch.zeros(0, 1)
        else:
            cands = obs.get("cands", [])
            attackers = obs.get("attackers", [])
            e["cand"] = self._perm_group(cands)
            e["atk"] = self._perm_group(attackers)
            e["cb"] = [c["cb"] for c in cands]
            e["n_opts"] = 1 + max((len(c["cb"]) for c in cands), default=0)
        return e

    # ---------- parameter math (batch-native) ----------

    def _tokens_b(self, group) -> torch.Tensor:
        text, struct, rt, hashes = group
        if text.size(1) == 0:
            return torch.zeros(text.size(0), 0, TOKEN_D, device=text.device)
        return torch.cat([self.text_proj(text), struct, rt, self.hash_emb(hashes)], dim=2)

    def forward_batch(self, be: dict) -> dict:
        hand = self.hand_enc(self._tokens_b(be["hand"]))
        my_bf = self.bf_enc(self._tokens_b(be["my"]))
        op_bf = self.bf_enc(self._tokens_b(be["op"]))
        z = self.trunk(torch.cat([hand, my_bf, op_bf, be["scalars"]], dim=1))
        v = self.value(z).squeeze(1)
        zq = self.action_proj(z)  # [B,64]
        head = be["head"]
        if head == "priority":
            cand = self._tokens_b(be["cand"])  # [B,nc,68]
            feats = torch.cat([cand, be["kind"]], dim=2)  # [B,nc,69]
            pass_row = self.pass_emb.expand(feats.size(0), -1, -1)
            feats = torch.cat([feats, pass_row], dim=1)   # [B,nc+1,69]
            logits = (self.cand_proj(feats) @ zq.unsqueeze(2)).squeeze(2) / math.sqrt(64)
            return {"head": head, "logits": logits, "v": v}
        if head == "attackers":
            cand = self._tokens_b(be["cand"])
            if cand.size(1) == 0:
                return {"head": head, "logits": torch.zeros(cand.size(0), 0, device=cand.device), "v": v}
            feats = torch.cat([cand, be["can"]], dim=2)
            logits = (self.combat_proj(feats) @ zq.unsqueeze(2)).squeeze(2) / math.sqrt(64)
            logits = logits.masked_fill(be["can"].squeeze(2) == 0, -1e9)
            return {"head": head, "logits": logits, "v": v}
        # blockers
        b, nc = be["cand"][0].size(0), be["cand"][0].size(1)
        n_opts = be["n_opts"]
        if nc == 0:
            return {"head": head, "logits": torch.zeros(b, 0, n_opts, device=zq.device), "v": v}
        cand = self._tokens_b(be["cand"])
        zeros_extra = torch.zeros(b, nc, 1, device=cand.device)
        prod_c = self.combat_proj(torch.cat([cand, zeros_extra], dim=2))  # [B,nc,64]
        none_score = (prod_c @ zq.unsqueeze(2)).squeeze(2) / math.sqrt(64)  # [B,nc]
        logits = torch.full((b, nc, n_opts), -1e9, device=zq.device)
        logits[:, :, 0] = none_score
        ncb = n_opts - 1
        na = be["atk"][0].size(1)
        if ncb > 0 and na > 0:
            atk = self._tokens_b(be["atk"])
            ones_extra = torch.ones(b, na, 1, device=atk.device)
            prod_a = self.combat_proj(torch.cat([atk, ones_extra], dim=2))  # [B,na,64]
            idx = be["cb"].clamp(min=0)  # [B,nc,ncb]
            gathered = prod_a.gather(1, idx.reshape(b, -1).unsqueeze(2).expand(b, -1, 64))
            gathered = gathered.reshape(b, nc, ncb, 64)
            block = (gathered * prod_c.unsqueeze(2)).sum(dim=3) / math.sqrt(64)  # [B,nc,ncb]
            block = block.masked_fill(be["cb"] < 0, -1e9)
            logits[:, :, 1:] = block
        return {"head": head, "logits": logits, "v": v}

    # ---------- single-obs compatibility (collection, B=1) ----------

    def apply_batched(self, es: list[dict], device=None) -> list[dict]:
        groups = group_indices(es)
        outs: list = [None] * len(es)
        for _key, idxs in groups.items():
            be = stack_enc_group([es[i] for i in idxs])
            if device is not None:
                be = move_batch(be, device)
            out = self.forward_batch(be)
            for j, i in enumerate(idxs):
                outs[i] = {"head": out["head"],
                           "logits": out["logits"][j],
                           "v": out["v"][j]}
        return outs

    def apply_encoded(self, e: dict) -> dict:
        return self.apply_batched([e])[0]

    def forward(self, obs: dict):
        return self.apply_encoded(self.preencode(obs))


def move_batch(be: dict, device) -> dict:
    out = {}
    for k, val in be.items():
        if torch.is_tensor(val):
            out[k] = val.to(device)
        elif isinstance(val, tuple):
            out[k] = tuple(t.to(device) for t in val)
        else:
            out[k] = val
    return out


def batch_action_stats(out: dict, actions: torch.Tensor):
    """Returns (logp [B], entropy [B]) for stored actions."""
    head = out["head"]
    logits = out["logits"]
    if head == "priority":
        dist = torch.distributions.Categorical(logits=logits)
        return dist.log_prob(actions), dist.entropy()
    if head == "attackers":
        dist = torch.distributions.Bernoulli(logits=logits)
        return dist.log_prob(actions.float()).sum(dim=1), dist.entropy().sum(dim=1)
    # blockers: logits [B,nc,n_opts], actions [B,nc]
    if logits.size(1) == 0:
        b = logits.size(0)
        z = torch.zeros(b, device=logits.device)
        return z, z
    logsm = F.log_softmax(logits, dim=2)
    logp = logsm.gather(2, actions.unsqueeze(2)).squeeze(2)  # [B,nc]
    p = logsm.exp()
    ent = -(p * logsm).sum(dim=2)  # [B,nc]
    return logp.sum(dim=1), ent.sum(dim=1)


# ---------- distributions / protocol (single-obs path) ----------

def action_dist(out: dict):
    head = out["head"]
    logits = out["logits"]
    if head == "priority":
        return torch.distributions.Categorical(logits=logits)
    if head == "attackers":
        return torch.distributions.Bernoulli(logits=logits)
    return _RaggedCategorical(logits)


class _RaggedCategorical:
    def __init__(self, logits):
        self.dists = [torch.distributions.Categorical(logits=row) for row in logits]

    def sample(self):
        return [d.sample() for d in self.dists]

    def log_prob(self, actions):
        if not self.dists:
            return torch.tensor(0.0)
        return sum(d.log_prob(torch.as_tensor(a)) for d, a in zip(self.dists, actions))

    def entropy(self):
        if not self.dists:
            return torch.tensor(0.0)
        return sum(d.entropy() for d in self.dists)


def to_protocol(obs: dict, out: dict, action) -> dict:
    head = out["head"]
    if head == "priority":
        n_acts = len(obs.get("acts", []))
        if action >= n_acts:
            return {"seat": obs["seat"], "pass": 1}
        return {"seat": obs["seat"], "play": int(action)}
    if head == "attackers":
        picks = [i for i, a in enumerate(action.tolist()) if a == 1]
        return {"seat": obs["seat"], "attackers": picks}
    pairs = []
    for i, a in enumerate(action):
        k = int(a)
        if k > 0:
            pairs.append([i, obs["cands"][i]["cb"][k - 1]])
    return {"seat": obs["seat"], "pairs": pairs}


def action_logprob(out: dict, action) -> torch.Tensor:
    dist = action_dist(out)
    if out["head"] == "priority":
        return dist.log_prob(torch.as_tensor(action))
    if out["head"] == "attackers":
        return dist.log_prob(torch.as_tensor(action).float()).sum()
    return dist.log_prob(action)
