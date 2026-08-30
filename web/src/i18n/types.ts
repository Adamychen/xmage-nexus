export type SupportedLanguage = 'es' | 'en' | 'de' | 'fr' | 'ja' | 'it' | 'pt' | 'ru' | 'zhs'

export interface LanguageInfo {
  code: SupportedLanguage
  name: string
  flag: string
}

export interface TranslationSchema {
  common: {
    save: string
    cancel: string
    close: string
    confirm: string
    delete: string
    edit: string
    yes: string
    no: string
    loading: string
    error: string
    search: string
    all: string
    online: string
    offline: string
    refresh: string
    clear: string
    copy: string
    copied: string
    done: string
    language: string
    card_language: string
  }
  login: {
    subtitle: string
    server_target: string
    server_local: string
    server_official: string
    server_custom: string
    connect_btn: string
    connecting: string
    username: string
    password: string
    avatar: string
    flag: string
    custom_server_hint: string
  }
  lobby: {
    brand_title: string
    online_count: string
    nav_new: string
    nav_tables: string
    nav_decks: string
    nav_history: string
    nav_ranking: string
    nav_downloads: string
    tables_heading: string
    tables_deck_hint: string
    active_deck: string
    empty_tables: string
    waiting_players: string
    create_table_btn: string
    join_human_btn: string
    join_ai_btn: string
    start_match_btn: string
    ready_status: string
    open_seat: string
    global_chat: string
    disconnect: string
    disconnect_confirm: string
  }
  game: {
    turn: string
    phase: string
    priority: string
    your_turn: string
    opponent_turn: string
    pass_priority: string
    combat: string
    declare_attackers: string
    declare_blockers: string
    damage: string
    life: string
    poison: string
    energy: string
    commander_damage: string
    lethal: string
    graveyard: string
    exile: string
    library: string
    hand: string
    stack: string
    revealed_hand: string
    concede: string
    concede_confirm: string
    you: string
    opponent: string
    draw_card: string
    untap: string
    tap_mana: string
    hold_priority: string
    stop_turn: string
  }
  dialogs: {
    mulligan_title: string
    mulligan_keep: string
    mulligan_take: string
    mulligan_london_hint: string
    voting_title: string
    planeswalker_title: string
    download_title: string
    download_start: string
    download_pause: string
    download_cancel: string
    download_resume: string
    download_clear: string
    download_symbols_btn: string
  }
  decks: {
    deck_builder: string
    search_cards: string
    my_decks: string
    popular_meta: string
    import_deck: string
    export_deck: string
    mana_curve: string
    basic_lands: string
    sample_hand: string
    total_cards: string
    creatures: string
    spells: string
    lands: string
    sideboard: string
    commander: string
    format_legal: string
    format_illegal: string
  }
}
