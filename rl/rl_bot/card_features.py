"""Frozen card feature table (name -> text embedding + structured features)."""
from __future__ import annotations

import zlib

import torch

HASH_BUCKETS = 4096


class CardTable:
    TEXT_D = 384
    STRUCT_D = 14

    def __init__(self, npz_path):
        data = __import__("numpy").load(npz_path, allow_pickle=False)
        self.names = [str(n) for n in data["names"]]
        self.index = {n: i for i, n in enumerate(self.names)}
        self.text = torch.from_numpy(data["text"].astype("float32"))
        self.struct = torch.from_numpy(data["struct"].astype("float32"))
        self.zero_text = torch.zeros(self.TEXT_D)
        self.zero_struct = torch.zeros(self.STRUCT_D)
        self.n_cards = self.text.size(0)

    def lookup(self, names: list[str]):
        """Returns (text [n,384], struct [n,14], hash_ids [n]) with zero rows for unknown names."""
        n = len(names)
        if n == 0:
            return (torch.zeros(0, self.TEXT_D), torch.zeros(0, self.STRUCT_D),
                    torch.zeros(0, dtype=torch.long))
        idx = [self.index.get(name, -1) for name in names]
        keep = [i for i, v in enumerate(idx) if v >= 0]
        text = torch.zeros(n, self.TEXT_D)
        struct = torch.zeros(n, self.STRUCT_D)
        if keep:
            src = torch.tensor([idx[i] for i in keep])
            text[keep] = self.text[src]
            struct[keep] = self.struct[src]
        hashes = torch.tensor([zlib.crc32(name.encode()) % HASH_BUCKETS for name in names],
                              dtype=torch.long)
        return text, struct, hashes
