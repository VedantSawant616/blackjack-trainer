"""
drills.py - Training drill modes for counting practice.

PURPOSE:
    Provides structured training exercises for:
    - Card counting speed and accuracy
    - Full play with hidden count verification
    - Strategy recall under pressure

RESPONSIBILITIES:
    - Run counting drill (rapid cards, RC input)
    - Run full play mode with count verification
    - Integrate with evaluator for error tracking

MUST NOT:
    - Track statistics across sessions (stats module does this)
    - Classify errors (evaluator module does this)
"""

import time
import random
from dataclasses import dataclass, field
from typing import List, Optional, Callable, Tuple
from enum import Enum

from ..game.shoe import Shoe
from ..game.deck import Card
from ..game.hand import Hand
from ..game.player import Player
from ..game.dealer import Dealer
from ..game.engine import GameEngine, Action
from ..counting.counter import Counter
from ..counting.hilo import get_hilo_value
from ..strategy.basic_strategy import BasicStrategy, Decision


class DrillType(Enum):
    """Available drill types."""
    COUNTING = "counting"      # Pure card counting practice
    FULL_PLAY = "full_play"   # Complete blackjack with hidden count


@dataclass
class CountingDrillResult:
    """Result of a single counting drill response."""
    cards_shown: List[Card]
    correct_count: int
    user_count: int
    is_correct: bool
    response_time_ms: float
    
    def __str__(self) -> str:
        status = "✓" if self.is_correct else "✗"
        return f"{status} Cards: {' '.join(str(c) for c in self.cards_shown)} | Expected: {self.correct_count:+d}, Got: {self.user_count:+d}"


@dataclass
class FullPlayResult:
    """Result of a single full play hand."""
    player_hand: Hand
    dealer_upcard: Card
    user_action: Action
    correct_action: Decision
    is_correct: bool
    user_count: Optional[int]
    correct_count: Optional[int]
    count_correct: Optional[bool]
    index_applicable: bool = False
    index_followed: bool = False
    
    def __str__(self) -> str:
        action_status = "✓" if self.is_correct else "✗"
        result = f"{action_status} {self.player_hand} vs {self.dealer_upcard}"
        if self.user_count is not None:
            count_status = "✓" if self.count_correct else "✗"
            result += f" | Count: {count_status} (RC={self.correct_count:+d})"
        return result


@dataclass
class CountingDrill:
    """
    Pure counting practice drill.
    
    Shows cards rapidly and asks user to input the running count.
    Tracks accuracy and response time.
    """
    shoe: Shoe = field(default_factory=Shoe)
    counter: Counter = field(default_factory=Counter)
    cards_per_round: int = 3  # Cards shown before asking for count
    results: List[CountingDrillResult] = field(default_factory=list)
    
    def reset(self) -> None:
        """Reset drill for a new session."""
        self.shoe.shuffle()
        self.counter.reset()
        self.results.clear()
    
    def deal_cards(self) -> Tuple[List[Card], int]:
        """
        Deal cards for one drill round.
        
        Returns:
            Tuple of (cards dealt, correct running count).
        """
        cards = []
        for _ in range(self.cards_per_round):
            if self.shoe.needs_shuffle:
                self.shoe.shuffle()
                self.counter.reset()
            
            card = self.shoe.deal()
            self.counter.count_card(card)
            cards.append(card)
        
        return cards, self.counter.running_count
    
    def check_answer(
        self, 
        cards: List[Card], 
        correct_count: int, 
        user_count: int,
        response_time_ms: float = 0.0
    ) -> CountingDrillResult:
        """
        Check user's answer and record result.
        
        Args:
            cards: Cards that were shown.
            correct_count: The correct running count.
            user_count: User's answer.
            response_time_ms: Time taken to respond.
        
        Returns:
            CountingDrillResult with the outcome.
        """
        result = CountingDrillResult(
            cards_shown=cards,
            correct_count=correct_count,
            user_count=user_count,
            is_correct=(user_count == correct_count),
            response_time_ms=response_time_ms
        )
        self.results.append(result)
        return result
    
    @property
    def accuracy(self) -> float:
        """Calculate accuracy percentage."""
        if not self.results:
            return 0.0
        correct = sum(1 for r in self.results if r.is_correct)
        return correct / len(self.results)
    
    @property
    def average_response_time(self) -> float:
        """Average response time in milliseconds."""
        if not self.results:
            return 0.0
        return sum(r.response_time_ms for r in self.results) / len(self.results)
    
    @property
    def current_streak(self) -> int:
        """Current consecutive correct answers."""
        streak = 0
        for result in reversed(self.results):
            if result.is_correct:
                streak += 1
            else:
                break
        return streak
    
    @property
    def best_streak(self) -> int:
        """Best consecutive correct answers."""
        best = 0
        current = 0
        for result in self.results:
            if result.is_correct:
                current += 1
                best = max(best, current)
            else:
                current = 0
        return best


@dataclass
class FullPlayDrill:
    """
    Full blackjack play with strategy and counting verification.
    
    Plays complete hands against the dealer with:
    - Strategy decision verification
    - Hidden running count quizzes
    - Index play detection
    """
    shoe: Shoe = field(default_factory=Shoe)
    player: Player = field(default_factory=Player)
    dealer: Dealer = field(default_factory=Dealer)
    counter: Counter = field(default_factory=Counter)
    strategy: BasicStrategy = field(default_factory=BasicStrategy)
    engine: GameEngine = field(init=False)
    results: List[FullPlayResult] = field(default_factory=list)
    
    # Quiz frequency for running count
    count_quiz_frequency: float = 0.3  # 30% of hands ask for count
    
    def __post_init__(self):
        # Initialize engine with card counting callback
        self.engine = GameEngine(
            shoe=self.shoe,
            player=self.player,
            dealer=self.dealer,
            on_card_exposed=self._on_card_exposed
        )
    
    def _on_card_exposed(self, card: Card) -> None:
        """Callback when a card is exposed - update counter."""
        self.counter.count_card(card)
    
    def reset(self) -> None:
        """Reset drill for a new session."""
        self.shoe.shuffle()
        self.counter.reset()
        self.player.bankroll = 1000.0
        self.results.clear()
    
    def start_hand(self, bet: Optional[float] = None) -> Tuple[Hand, Card]:
        """
        Start a new hand.
        
        Returns:
            Tuple of (player's hand, dealer's upcard).
        """
        return self.engine.start_round(bet)
    
    def get_correct_action(self, hand: Hand, dealer_upcard: Card) -> Decision:
        """Get the correct basic strategy action."""
        return self.strategy.get_decision(
            hand,
            dealer_upcard,
            can_double=hand.can_double,
            can_split=hand.can_split and self.player.can_split,
            can_surrender=hand.can_surrender
        )
    
    def check_action(
        self,
        hand: Hand,
        dealer_upcard: Card,
        user_action: Action
    ) -> bool:
        """
        Check if user's action matches basic strategy.
        
        Args:
            hand: Current player hand.
            dealer_upcard: Dealer's upcard.
            user_action: Action chosen by user.
        
        Returns:
            True if action is correct.
        """
        correct = self.get_correct_action(hand, dealer_upcard)
        
        # Map user action to decision for comparison
        action_to_decision = {
            Action.HIT: Decision.HIT,
            Action.STAND: Decision.STAND,
            Action.DOUBLE: Decision.DOUBLE,
            Action.SPLIT: Decision.SPLIT,
            Action.SURRENDER: Decision.SURRENDER_HIT,
        }
        
        user_decision = action_to_decision.get(user_action)
        
        # Handle special cases
        if correct == Decision.DOUBLE_STAND:
            return user_decision in (Decision.DOUBLE, Decision.STAND)
        if correct == Decision.SURRENDER_HIT:
            return user_decision in (Decision.SURRENDER_HIT, Decision.HIT)
        
        return user_decision == correct
    
    def should_quiz_count(self) -> bool:
        """Determine if we should quiz the running count this hand."""
        return random.random() < self.count_quiz_frequency
    
    def record_result(
        self,
        hand: Hand,
        dealer_upcard: Card,
        user_action: Action,
        user_count: Optional[int] = None
    ) -> FullPlayResult:
        """
        Record the result of a hand decision.
        
        Args:
            hand: Player hand.
            dealer_upcard: Dealer upcard.
            user_action: User's chosen action.
            user_count: User's running count guess (if quizzed).
        
        Returns:
            FullPlayResult with outcome.
        """
        correct_action = self.get_correct_action(hand, dealer_upcard)
        is_correct = self.check_action(hand, dealer_upcard, user_action)
        
        count_correct = None
        if user_count is not None:
            count_correct = (user_count == self.counter.running_count)
        
        result = FullPlayResult(
            player_hand=Hand(cards=list(hand.cards)),  # Copy
            dealer_upcard=dealer_upcard,
            user_action=user_action,
            correct_action=correct_action,
            is_correct=is_correct,
            user_count=user_count,
            correct_count=self.counter.running_count if user_count is not None else None,
            count_correct=count_correct
        )
        self.results.append(result)
        return result
    
    @property
    def strategy_accuracy(self) -> float:
        """Strategy decision accuracy."""
        if not self.results:
            return 0.0
        correct = sum(1 for r in self.results if r.is_correct)
        return correct / len(self.results)
    
    @property
    def count_accuracy(self) -> float:
        """Running count accuracy (only quizzed hands)."""
        quizzed = [r for r in self.results if r.count_correct is not None]
        if not quizzed:
            return 0.0
        correct = sum(1 for r in quizzed if r.count_correct)
        return correct / len(quizzed)
    
    @property
    def hands_played(self) -> int:
        """Total hands played."""
        return len(self.results)
