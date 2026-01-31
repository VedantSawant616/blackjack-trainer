# Blackjack Counting Trainer

A production-quality, single-deck blackjack simulator designed for **training card counting and decision accuracy**.

## Philosophy

This is **NOT** a casino game or entertainment app.
This is a **personal training tool** to master:

- **Hi-Lo card counting** — track running count, convert to true count
- **Single-deck basic strategy** — memorize correct plays for every situation
- **Index deviations** — know when to deviate based on the count (Illustrious 18 + Fab 4)
- **Speed and accuracy under pressure** — build the reflexes needed at a real table

## Features

### Training Modes

| Mode | Description |
|------|-------------|
| **Counting Drill** | Rapid card flashing, input running count. Immediate feedback on errors. |
| **Full Play** | Complete blackjack hands with hidden count. Strategy + counting combined. |

### Error Classification

Every mistake is categorized:
- **Counting Error** — Wrong running count
- **Strategy Error** — Incorrect basic strategy decision
- **Index Error** — Failed to apply a count-based deviation

### Session Statistics

After each session:
- Hands played
- Running count accuracy %
- Strategy error rate
- Estimated EV lost
- Best streak (consecutive correct decisions)

## Installation

```bash
cd blackjack-counting-trainer
pip install -r requirements.txt
```

## Usage

```bash
python src/main.py
```

### Quick Start

```
=== Blackjack Counting Trainer ===

1. Counting Drill
2. Full Play (Training Mode)
3. Settings
4. Exit

Select mode: _
```

## Configuration

Default settings (configurable in `src/config.py` or via CLI):

| Setting | Default | Options |
|---------|---------|---------|
| Dealer rule | H17 | H17, S17 |
| Penetration | 65% | 50-90% |
| True count method | Decks remaining | - |
| Index plays | Illustrious 18 + Fab 4 | - |

## Project Structure

```
blackjack-counting-trainer/
├── README.md
├── requirements.txt
├── src/
│   ├── main.py              # CLI entry point
│   ├── config.py            # Configuration
│   ├── game/
│   │   ├── deck.py          # Single 52-card deck
│   │   ├── shoe.py          # Shuffle + penetration
│   │   ├── hand.py          # Hand totals
│   │   ├── player.py        # Player state
│   │   ├── dealer.py        # Dealer logic
│   │   └── engine.py        # Game orchestration
│   ├── counting/
│   │   ├── hilo.py          # Hi-Lo tag values
│   │   └── counter.py       # Running/true count
│   ├── strategy/
│   │   ├── basic_strategy.py # Single-deck basic strategy
│   │   └── index_play.py     # Illustrious 18 + Fab 4
│   ├── training/
│   │   ├── drills.py        # Training modes
│   │   └── evaluator.py     # Error classification
│   └── stats/
│       └── tracker.py       # Session statistics
└── tests/
```

## Rules Implemented

- **Single deck only** (52 cards)
- **Dealer hits/stands soft 17** (configurable)
- **Double on any two cards**
- **Double after split** (DAS) allowed
- **Split up to 3 times** (4 hands max)
- **Resplit Aces** allowed
- **Surrender** available (late surrender)
- **Hole card NOT counted until revealed** (realistic training)

## True Count Calculation

```
True Count = Running Count / Decks Remaining
Decks Remaining = Cards Remaining / 52
```

For single deck with 65% penetration (34 cards dealt, 18 remaining):
```
Decks Remaining = 18 / 52 ≈ 0.35
If RC = +3, then TC = 3 / 0.35 ≈ +8.6
```

## License

MIT — Use this to beat the casino. (Legally, of course.)
