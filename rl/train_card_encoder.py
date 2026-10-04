"""Supervised domain adaptation of MiniLM on card oracle text.

Task: from name+oracle text predict types (8), colors (5), mana value bucket (9),
top-K subtypes (multi-label). Labels are free from data/cards.jsonl, so this is
dense signal — unlike RL rewards.

Output: data/card_encoder.pt (AutoModel state_dict) for build_card_embeddings.py.

Usage: uv run train_card_encoder.py [--epochs 6]
"""
import argparse
import json
from collections import Counter
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModel, AutoTokenizer

ROOT = Path(__file__).parent
CARDS = ROOT / "data/cards.jsonl"
OUT = ROOT / "data/card_encoder.pt"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
TYPE_ORDER = ["ARTIFACT", "CREATURE", "ENCHANTMENT", "INSTANT",
              "LAND", "PLANESWALKER", "SORCERY", "BATTLE"]
TOPK = 256


class CardDS(Dataset):
    def __init__(self, texts, types, colors, mv, subs):
        self.texts, self.types, self.colors, self.mv, self.subs = texts, types, colors, mv, subs

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, i):
        return self.texts[i], self.types[i], self.colors[i], self.mv[i], self.subs[i]


class Heads(torch.nn.Module):
    def __init__(self, d=384):
        super().__init__()
        self.types = torch.nn.Linear(d, len(TYPE_ORDER))
        self.colors = torch.nn.Linear(d, 5)
        self.mv = torch.nn.Linear(d, 9)
        self.subs = torch.nn.Linear(d, TOPK)


def mean_pool(last_hidden, mask):
    mask = mask.unsqueeze(-1).float()
    return (last_hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=2e-5)
    args = ap.parse_args()

    cards = [json.loads(line) for line in open(CARDS)]
    sub_counter = Counter(s for c in cards for s in c.get("sub", []))
    sub_vocab = [s for s, _ in sub_counter.most_common(TOPK)]
    sub_idx = {s: i for i, s in enumerate(sub_vocab)}
    print(f"{len(cards)} cards, {len(sub_vocab)} subtypes vocab")

    texts, types, colors, mvs, subs = [], [], [], [], []
    for c in cards:
        texts.append(c["n"] + (" | " + " ".join(c.get("rules", [])) if c.get("rules") else ""))
        t = [1.0 if name in c["ty"] else 0.0 for name in TYPE_ORDER]
        types.append(t)
        colors.append([1.0 if (c["c"] >> i) & 1 else 0.0 for i in range(5)])
        mvs.append(min(c["mv"], 8))
        s = [0.0] * TOPK
        for name in c.get("sub", []):
            if name in sub_idx:
                s[sub_idx[name]] = 1.0
        subs.append(s)
    ds = CardDS(texts, torch.tensor(types), torch.tensor(colors),
                torch.tensor(mvs), torch.tensor(subs))

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME).to(device)
    heads = Heads().to(device)
    opt = torch.optim.AdamW(list(model.parameters()) + list(heads.parameters()), lr=args.lr)

    def collate(batch):
        tx = tok([b[0] for b in batch], padding=True, truncation=True,
                 return_tensors="pt", max_length=96)
        return (tx, torch.stack([b[1] for b in batch]), torch.stack([b[2] for b in batch]),
                torch.stack([b[3] for b in batch]), torch.stack([b[4] for b in batch]))

    dl = DataLoader(ds, batch_size=args.batch, shuffle=True, collate_fn=collate, num_workers=0)
    for epoch in range(args.epochs):
        total, n = 0.0, 0
        for tx, ty, co, mv, su in dl:
            tx = {k: v.to(device) for k, v in tx.items()}
            ty, co, mv, su = ty.to(device), co.to(device), mv.to(device), su.to(device)
            out = model(**tx)
            z = mean_pool(out.last_hidden_state, tx["attention_mask"])
            loss = (F.binary_cross_entropy_with_logits(heads.types(z), ty)
                    + F.binary_cross_entropy_with_logits(heads.colors(z), co)
                    + F.cross_entropy(heads.mv(z), mv)
                    + F.binary_cross_entropy_with_logits(heads.subs(z), su))
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += float(loss)
            n += 1
        print(f"epoch {epoch + 1}/{args.epochs} loss={total / n:.4f}", flush=True)

    torch.save(model.state_dict(), OUT)
    print(f"saved {OUT}")


if __name__ == "__main__":
    main()
