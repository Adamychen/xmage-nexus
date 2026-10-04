import random

# type bitmask: ARTIFACT=1, CREATURE=2, ENCHANTMENT=4, INSTANT=8,
# LAND=16, PLANESWALKER=32, SORCERY=64, BATTLE=128
T_LAND = 16
T_CREATURE = 2


def random_act(obs: dict, rng: random.Random) -> dict:
    prompt = obs["prompt"]
    if prompt == "priority":
        acts = obs.get("acts", [])
        if acts and rng.random() < 0.5:
            return {"seat": obs["seat"], "play": rng.randrange(len(acts))}
        return {"seat": obs["seat"], "pass": 1}
    if prompt == "attackers":
        ids = [c["i"] for c in obs.get("cands", []) if c["can"]]
        picks = [i for i in ids if rng.random() < 0.5]
        return {"seat": obs["seat"], "attackers": picks}
    if prompt == "blockers":
        pairs = []
        for c in obs.get("cands", []):
            if c["cb"] and rng.random() < 0.5:
                pairs.append([c["i"], c["cb"][0]])
        return {"seat": obs["seat"], "pairs": pairs}
    return {"seat": obs["seat"], "pass": 1}


def heuristic_act(obs: dict, rng: random.Random) -> dict:
    """Deck-agnostic greedy: land, then creatures, then any spell; all-in, no blocks."""
    prompt = obs["prompt"]
    if prompt == "priority":
        acts = obs.get("acts", [])
        lands = [i for i, a in enumerate(acts) if (a.get("ty", 0) & T_LAND)]
        creatures = [i for i, a in enumerate(acts)
                     if a.get("k") == "cast" and (a.get("ty", 0) & T_CREATURE)]
        spells = [i for i, a in enumerate(acts) if a.get("k") == "cast"]
        if lands:
            return {"seat": obs["seat"], "play": lands[0]}
        if creatures:
            return {"seat": obs["seat"], "play": creatures[0]}
        if spells:
            return {"seat": obs["seat"], "play": spells[0]}
        return {"seat": obs["seat"], "pass": 1}
    if prompt == "attackers":
        picks = [c["i"] for c in obs.get("cands", []) if c["can"]]
        return {"seat": obs["seat"], "attackers": picks}
    if prompt == "blockers":
        return {"seat": obs["seat"], "pairs": []}
    return {"seat": obs["seat"], "pass": 1}


def act_by(name: str, obs: dict, rng: random.Random) -> dict:
    if name == "random":
        return random_act(obs, rng)
    if name == "heuristic":
        return heuristic_act(obs, rng)
    raise ValueError(name)
