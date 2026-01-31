"""
config.py - Configuration constants and settings.

PURPOSE:
    Centralized configuration for all game rules and training settings.
    Allows customization without modifying code.

SETTINGS:
    - Game rules (H17/S17, DAS, etc.)
    - Training parameters
    - Display options
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from .game.dealer import DealerRule


@dataclass
class GameConfig:
    """
    Blackjack game rule configuration.
    
    Attributes:
        dealer_rule: H17 (hit soft 17) or S17 (stand soft 17).
        penetration: Fraction of deck dealt before shuffle (0.0 to 1.0).
        blackjack_payout: Payout ratio for blackjack (1.5 = 3:2, 1.2 = 6:5).
        allow_das: Double After Split allowed.
        allow_surrender: Late surrender allowed.
        max_splits: Maximum number of splits allowed.
        resplit_aces: Can resplit Aces.
    """
    dealer_rule: DealerRule = DealerRule.H17
    penetration: float = 0.65
    blackjack_payout: float = 1.5
    allow_das: bool = True
    allow_surrender: bool = True
    max_splits: int = 3
    resplit_aces: bool = True
    
    def __str__(self) -> str:
        return (
            f"Game Rules:\n"
            f"  Dealer: {self.dealer_rule.value.upper()}\n"
            f"  Penetration: {self.penetration:.0%}\n"
            f"  Blackjack pays: {self.blackjack_payout}:1\n"
            f"  DAS: {'Yes' if self.allow_das else 'No'}\n"
            f"  Surrender: {'Yes' if self.allow_surrender else 'No'}\n"
            f"  Max splits: {self.max_splits}"
        )


@dataclass
class TrainingConfig:
    """
    Training mode configuration.
    
    Attributes:
        cards_per_drill: Cards shown per counting drill round.
        count_quiz_frequency: Frequency of RC quizzes in full play (0.0 to 1.0).
        show_true_count: Show true count after each hand.
        show_correct_action: Show correct action after mistakes.
        auto_advance_delay_ms: Delay before next drill round (0 = wait for input).
        starting_bankroll: Initial bankroll for full play.
        base_bet: Default bet size.
    """
    cards_per_drill: int = 3
    count_quiz_frequency: float = 0.3
    show_true_count: bool = False
    show_correct_action: bool = True
    auto_advance_delay_ms: int = 0
    starting_bankroll: float = 1000.0
    base_bet: float = 10.0
    
    def __str__(self) -> str:
        return (
            f"Training Settings:\n"
            f"  Cards per drill: {self.cards_per_drill}\n"
            f"  Count quiz freq: {self.count_quiz_frequency:.0%}\n"
            f"  Show correct: {'Yes' if self.show_correct_action else 'No'}"
        )


@dataclass
class DisplayConfig:
    """
    Display and formatting configuration.
    
    Attributes:
        use_unicode_cards: Use Unicode card symbols.
        color_output: Use ANSI colors in terminal.
        clear_screen: Clear screen between actions.
        compact_mode: Reduce output verbosity.
    """
    use_unicode_cards: bool = True
    color_output: bool = True
    clear_screen: bool = True
    compact_mode: bool = False


@dataclass
class AppConfig:
    """
    Complete application configuration.
    """
    game: GameConfig = field(default_factory=GameConfig)
    training: TrainingConfig = field(default_factory=TrainingConfig)
    display: DisplayConfig = field(default_factory=DisplayConfig)
    stats_file: Optional[str] = None
    
    @classmethod
    def default(cls) -> 'AppConfig':
        """Create default configuration."""
        return cls()
    
    @classmethod
    def s17_rules(cls) -> 'AppConfig':
        """Create configuration with S17 dealer rules."""
        config = cls()
        config.game.dealer_rule = DealerRule.S17
        return config
    
    def __str__(self) -> str:
        return f"{self.game}\n\n{self.training}"


# Default configuration instance
DEFAULT_CONFIG = AppConfig.default()
