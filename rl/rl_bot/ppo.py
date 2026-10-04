"""PPO with shape-grouped batched forwards (CPU or MPS)."""
from __future__ import annotations

import random

import torch

from .model import (
    Net, batch_action_stats, group_indices, move_batch, stack_actions, stack_enc_group,
)

GAMMA = 0.999  # long uncapped episodes: death or decking decides, ~hundreds of steps
CLIP = 0.2
ENT_COEF = 0.01
VF_COEF = 0.5
EPOCHS = 3


def annotate_returns(episode: list[dict], terminal: float):
    r = terminal
    for step in reversed(episode):
        r = GAMMA * r
        step["return"] = r
        step["adv"] = r - step["value"]


def ppo_update(net: Net, optim: torch.optim.Optimizer, transitions: list[dict],
               minibatch: int = 256, device=None) -> dict:
    for t in transitions:
        if "enc" not in t:
            t["enc"] = net.preencode(t["obs"])
    if device is None:
        device = next(net.parameters()).device
    adv = torch.tensor([t["adv"] for t in transitions], dtype=torch.float32)
    if adv.numel() > 1:
        adv = (adv - adv.mean()) / (adv.std() + 1e-8)
    idx = list(range(len(transitions)))
    sums = {"pg": 0.0, "v": 0.0, "ent": 0.0, "n": 0}
    for _ in range(EPOCHS):
        random.shuffle(idx)
        for start in range(0, len(idx), minibatch):
            chunk = idx[start:start + minibatch]
            encs = [transitions[i]["enc"] for i in chunk]
            groups = group_indices(encs)
            loss = torch.zeros((), device=device)
            pg_sum = v_sum = ent_sum = 0.0
            n = len(chunk)
            for _key, locals_ in groups.items():
                gidx = [chunk[j] for j in locals_]
                be = move_batch(stack_enc_group([transitions[i]["enc"] for i in gidx]), device)
                out = net.forward_batch(be)
                actions = stack_actions([transitions[i]["action"] for i in gidx], out["head"]).to(device)
                logp, ent = batch_action_stats(out, actions)
                old_logp = torch.stack([transitions[i]["old_logp"] for i in gidx]).to(device)
                a_adv = adv[gidx].to(device)
                ret = torch.tensor([transitions[i]["return"] for i in gidx],
                                   dtype=torch.float32, device=device)
                ratio = torch.exp(logp - old_logp)
                clipped = torch.clamp(ratio, 1 - CLIP, 1 + CLIP)
                pg = -torch.min(ratio * a_adv, clipped * a_adv)
                v_loss = (out["v"] - ret) ** 2
                loss = loss + pg.sum() + VF_COEF * v_loss.sum() - ENT_COEF * ent.sum()
                pg_sum += float(pg.detach().sum())
                v_sum += float(v_loss.detach().sum())
                ent_sum += float(ent.detach().sum())
            loss = loss / n
            optim.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(net.parameters(), 1.0)
            optim.step()
            sums["pg"] += pg_sum / n
            sums["v"] += v_sum / n
            sums["ent"] += ent_sum / n
            sums["n"] += 1
    for k in ("pg", "v", "ent"):
        sums[k] /= max(1, sums["n"])
    return sums
