"""Build the frozen card feature table from data/cards.jsonl.

Output: data/card_emb.npz
  names  [N]      card names (key)
  text   [N, 384] float16 embedding of name + oracle text (MiniLM, optionally
                  fine-tuned by train_card_encoder.py)
  struct [N, 14]  float16 structured features (mv/10, 5 color bits, 8 type bits)

Usage: uv run build_card_embeddings.py [--encoder data/card_encoder.pt]
"""
import argparse
import json
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

ROOT = Path(__file__).parent
CARDS = ROOT / "data/cards.jsonl"
OUT = ROOT / "data/card_emb.npz"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

TYPE_ORDER = [
    "ARTIFACT", "CREATURE", "ENCHANTMENT", "INSTANT",
    "LAND", "PLANESWALKER", "SORCERY", "BATTLE",
]


def struct_vec(card: dict) -> np.ndarray:
    v = np.zeros(14, dtype=np.float32)
    v[0] = min(card.get("mv", 0), 10) / 10.0
    for i in range(5):
        v[1 + i] = 1.0 if (card.get("c", 0) >> i) & 1 else 0.0
    types = set(card.get("ty", []))
    for i, t in enumerate(TYPE_ORDER):
        v[6 + i] = 1.0 if t in types else 0.0
    return v


def mean_pool(last_hidden, mask):
    mask = mask.unsqueeze(-1).float()
    return (last_hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--encoder", default="", help="state_dict from train_card_encoder.py")
    args = ap.parse_args()

    cards = [json.loads(line) for line in open(CARDS)]
    print(f"{len(cards)} cards")
    names = np.array([c["n"] for c in cards])
    struct = np.stack([struct_vec(c) for c in cards]).astype(np.float16)

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME)
    if args.encoder:
        model.load_state_dict(torch.load(args.encoder, map_location="cpu"))
        print(f"loaded fine-tuned encoder {args.encoder}")
    model.to(device).eval()

    texts = [
        c["n"] + (" | " + " ".join(c.get("rules", [])) if c.get("rules") else "")
        for c in cards
    ]
    embs = []
    batch = 256
    with torch.no_grad():
        for i in range(0, len(texts), batch):
            tx = tok(texts[i:i + batch], padding=True, truncation=True,
                     return_tensors="pt", max_length=96)
            tx = {k: v.to(device) for k, v in tx.items()}
            z = mean_pool(model(**tx).last_hidden_state, tx["attention_mask"])
            z = torch.nn.functional.normalize(z, dim=1)
            embs.append(z.cpu().numpy())
            if i % 4096 == 0:
                print(f"  {i}/{len(texts)}", flush=True)
    text = np.concatenate(embs).astype(np.float16)
    print("text emb", text.shape, text.dtype)
    np.savez_compressed(OUT, names=names, text=text, struct=struct)
    size_mb = OUT.stat().st_size / 1e6
    print(f"saved {OUT} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
