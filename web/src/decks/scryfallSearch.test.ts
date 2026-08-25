import { describe, it, expect } from 'vitest'
import {
  scryfallCardImage,
  scryfallCardBackImage,
  scryfallCardArtCrop,
  type ScryfallSearchCard,
} from './scryfallSearch'

describe('scryfallSearch', () => {
  const singleFaceCard: ScryfallSearchCard = {
    id: 'card-1',
    name: 'Lightning Bolt',
    set: 'M10',
    collector_number: '146',
    cmc: 1,
    mana_cost: '{R}',
    type_line: 'Instant',
    colors: ['R'],
    color_identity: ['R'],
    image_uris: {
      small: 'https://cards.scryfall.io/small/bolt.jpg',
      normal: 'https://cards.scryfall.io/normal/bolt.jpg',
      art_crop: 'https://cards.scryfall.io/art_crop/bolt.jpg',
    },
  }

  const doubleFaceCard: ScryfallSearchCard = {
    id: 'card-2',
    name: 'Delver of Secrets // Insectile Aberration',
    set: 'ISD',
    collector_number: '51',
    cmc: 1,
    mana_cost: '{U}',
    type_line: 'Creature — Human Wizard',
    colors: ['U'],
    color_identity: ['U'],
    card_faces: [
      {
        image_uris: {
          small: 'https://cards.scryfall.io/small/delver_front.jpg',
          normal: 'https://cards.scryfall.io/normal/delver_front.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/delver_front.jpg',
        },
        mana_cost: '{U}',
        type_line: 'Creature — Human Wizard',
      },
      {
        image_uris: {
          small: 'https://cards.scryfall.io/small/delver_back.jpg',
          normal: 'https://cards.scryfall.io/normal/delver_back.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/delver_back.jpg',
        },
        type_line: 'Creature — Human Insect',
      },
    ],
  }

  it('extracts normal card image correctly', () => {
    expect(scryfallCardImage(singleFaceCard)).toBe('https://cards.scryfall.io/normal/bolt.jpg')
    expect(scryfallCardImage(doubleFaceCard)).toBe('https://cards.scryfall.io/normal/delver_front.jpg')
  })

  it('extracts back face card image correctly', () => {
    expect(scryfallCardBackImage(singleFaceCard)).toBeNull()
    expect(scryfallCardBackImage(doubleFaceCard)).toBe('https://cards.scryfall.io/normal/delver_back.jpg')
  })

  it('extracts art crop image correctly', () => {
    expect(scryfallCardArtCrop(singleFaceCard)).toBe('https://cards.scryfall.io/art_crop/bolt.jpg')
    expect(scryfallCardArtCrop(doubleFaceCard)).toBe('https://cards.scryfall.io/art_crop/delver_front.jpg')
  })
})
