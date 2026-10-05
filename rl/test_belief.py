"""Offline sanity for the v3 belief model: fake obs (all 3 heads + labels),
single-obs forward, batched PPO update with aux losses, aux targets decrease."""
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))
from rl_bot.card_features import CardTable  # noqa: E402
from rl_bot.model import BELIEF_D, Net, action_dist, action_logprob, to_protocol  # noqa: E402
from rl_bot.ppo import annotate_returns, ppo_update  # noqa: E402

DATA = Path(__file__).parent / "data"
DECKS = sorted((Path(__file__).parent / "decks").glob("*.dck"))
DECK_NAMES = [p.stem for p in DECKS]
table = CardTable(DATA / "card_emb.npz")

PERM = {"n": "Grizzly Bears", "t": 0, "ty": 2, "co": 16, "mv": 2,
        "dmg": 0, "cnt": 0, "p": 2, "h": 2}


def fake_obs(prompt: str, with_labels: bool = True) -> dict:
    obs = {
        "seat": "A", "prompt": prompt, "turn": 5, "step": "Precombat Main",
        "active": "A", "stack": 0,
        "me": {"life": 18, "lib": 35, "hand": ["Mountain", "Lightning Bolt"],
               "gy": ["Shock"], "bf": [dict(PERM)]},
        "op": {"life": 20, "lib": 40, "handCount": 6, "gy": ["Grizzly Bears"],
               "bf": [dict(PERM, n="Savannah Lions", p=2, h=1)]},
    }
    if prompt == "priority":
        obs["acts"] = [{"n": "Mountain", "k": "act", "ty": 16, "co": 16, "mv": 0},
                       {"n": "Lightning Bolt", "k": "cast", "ty": 8, "co": 8, "mv": 1}]
    elif prompt == "attackers":
        obs["cands"] = [dict(PERM, i=0, can=1), dict(PERM, i=1, n="Savannah Lions", can=0)]
    else:
        obs["cands"] = [dict(PERM, i=0, cb=[0])]
        obs["attackers"] = [dict(PERM, n="Savannah Lions", p=2, h=1)]
    if with_labels:
        obs["deck"] = DECK_NAMES[0]
        obs["opDeck"] = DECK_NAMES[1 % len(DECK_NAMES)]
        obs["opHand"] = ["Plains", "Savannah Lions", "Swords to Plowshares"]
    return obs


net = Net(table, DECK_NAMES)
n_params = sum(p.numel() for p in net.parameters())
print(f"params={n_params} arch_classes={len(net.deck_names)}")

# 1. single-obs forward for each head (collection path)
for prompt, act_check in (("priority", lambda a: a is not None),
                          ("attackers", lambda a: a.numel() == 2),
                          ("blockers", lambda a: len(a) == 1)):
    obs = fake_obs(prompt)
    out = net(obs)
    dist = action_dist(out)
    action = dist.sample()
    lp = action_logprob(out, action)
    proto = to_protocol(obs, out,
                        int(action) if prompt == "priority"
                        else (action.long() if prompt == "attackers"
                              else [int(x) for x in action]))
    assert out["hand_pred"].shape == (384,) and out["arch_logits"].shape == (len(DECK_NAMES),)
    assert float(out["v"]) == float(out["v"]), "NaN in value"
    print(f"  {prompt}: logits {tuple(out['logits'].shape)} logp={float(lp):.3f} proto={proto}")

# 2. belief vector sanity: seen cards -> nonzero mean text emb, has-seen flag
b = net.preencode(fake_obs("priority"))["belief"]
assert b.shape == (BELIEF_D,) and b[-1] == 1.0 and b[:384].abs().sum() > 0
obs_clear = fake_obs("priority")
obs_clear["op"]["bf"] = []
obs_clear["op"]["gy"] = []
b_empty = net.preencode(obs_clear)["belief"]
assert b_empty[-1] == 0.0 and b_empty.abs().sum() == 0

# 3. batched PPO update with aux losses; hand/arch losses must be finite and move
torch.manual_seed(0)
transitions = []
for i in range(24):
    prompt = ["priority", "attackers", "blockers"][i % 3]
    obs = fake_obs(prompt, with_labels=(i % 4 != 3))  # some unlabeled transitions
    out = net(obs)
    action = action_dist(out).sample()
    stored = (int(action) if prompt == "priority"
              else action.long() if prompt == "attackers"
              else [int(x) for x in action])
    transitions.append({"obs": obs, "action": stored,
                        "old_logp": action_logprob(out, action).detach(),
                        "value": float(out["v"]), "seat": "A"})
    annotate_returns([transitions[-1]], 1.0 if i % 2 else -1.0)

optim = torch.optim.Adam(net.parameters(), lr=3e-3)
s0 = ppo_update(net, optim, transitions, 64)
assert all(v == v for v in s0.values()), f"NaN in stats {s0}"
s1 = ppo_update(net, optim, transitions, 64)
print(f"  stats upd1: {s0}")
print(f"  stats upd2: {s1}")
assert s1["arch"] < s0["arch"], "arch aux loss not decreasing"

# 4. aux heads actually learn the labels (overfit check)
net2 = Net(table, DECK_NAMES)
optim2 = torch.optim.Adam(net2.parameters(), lr=3e-3)
with torch.no_grad():
    hand_mse0 = sum(float(((net2(t["obs"])["hand_pred"]
                            - net2.preencode(t["obs"])["hand_tgt"]) ** 2).mean())
                    for t in transitions if net2.preencode(t["obs"])["hand_tgt"] is not None)
for _ in range(60):
    ppo_update(net2, optim2, transitions, 64)
acc = 0
tot = 0
hand_mse1 = 0.0
with torch.no_grad():
    for t in transitions:
        e = net2.preencode(t["obs"])
        out = net2(t["obs"])
        if e["arch_tgt"] >= 0:
            tot += 1
            acc += int(out["arch_logits"].argmax() == e["arch_tgt"])
        if e["hand_tgt"] is not None:
            hand_mse1 += float(((out["hand_pred"] - e["hand_tgt"]) ** 2).mean())
print(f"  arch accuracy after overfit: {acc}/{tot}, hand mse {hand_mse0:.4f} -> {hand_mse1:.4f}")
assert tot and acc / tot > 0.8, "arch head failed to learn"
assert hand_mse1 < hand_mse0, "hand head failed to learn"

print("ALL BELIEF-MODEL CHECKS PASSED")