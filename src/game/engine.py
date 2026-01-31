"""
engine.py - Game orchestration for blackjack.

PURPOSE:
    Manages the flow of a blackjack round without knowing about counting
    or strategy. This is pure game mechanics.

RESPONSIBILITIES:
    - Deal initial cards
    - Manage player actions (hit, stand, double, split, surrender)
    - Execute dealer play
    - Determine winners and calculate payouts
    - Signal when cards are exposed (for counting)

MUST NOT:
    - Make strategy decisions (that's up to the caller)
    - Track the count (counter module does this)
    - Manage multiple rounds (training module does this)
"""

from dataclasses import dataclass, field
from typing import List, Callable, Optional, Tuple
from enum import Enum

from .shoe import Shoe
from .hand import Hand, HandStatus
from .player import Player
from .dealer import Dealer, DealerRule
from .deck import Card


class Action(Enum):
    """Available player actions."""
    HIT = "hit"
    STAND = "stand"
    DOUBLE = "double"
    SPLIT = "split"
    SURRENDER = "surrender"


class RoundResult(Enum):
    """Possible outcomes for a single hand."""
    WIN = "win"
    LOSE = "lose"
    PUSH = "push"
    BLACKJACK = "blackjack"
    SURRENDER = "surrender"


@dataclass
class HandResult:
    """Result of a single hand after the round."""
    hand: Hand
    result: RoundResult
    payout: float  # Net payout (can be negative for losses)
    
    def __str__(self) -> str:
        return f"{self.result.value.upper()}: {self.hand} -> ${self.payout:+.2f}"


@dataclass  
class RoundSummary:
    """Summary of a complete round."""
    player_hands: List[HandResult]
    dealer_hand: Hand
    total_payout: float
    
    @property
    def net_result(self) -> float:
        """Net result (positive = player won, negative = player lost)."""
        return self.total_payout
    
    def __str__(self) -> str:
        lines = [
            f"Dealer: {self.dealer_hand}",
            "Player hands:"
        ]
        for hr in self.player_hands:
            lines.append(f"  {hr}")
        lines.append(f"Net: ${self.total_payout:+.2f}")
        return "\n".join(lines)


CardCallback = Callable[[Card], None]


@dataclass
class GameEngine:
    """
    Orchestrates a single round of blackjack.
    
    The engine is stateless between rounds — it manages the flow of one
    round and returns results. It does NOT:
    - Track counting (caller registers cards via on_card_exposed callback)
    - Make decisions (caller provides actions)
    - Manage bankroll across sessions
    
    Attributes:
        shoe: The card shoe to deal from.
        player: The player.
        dealer: The dealer.
        on_card_exposed: Callback when a card is exposed (for counting).
        blackjack_payout: Payout ratio for blackjack (3:2 = 1.5, 6:5 = 1.2).
    """
    shoe: Shoe
    player: Player
    dealer: Dealer
    on_card_exposed: Optional[CardCallback] = None
    blackjack_payout: float = 1.5  # 3:2 payout
    
    _round_in_progress: bool = field(default=False, repr=False)
    
    def _deal_card(self, hand: Hand, face_up: bool = True) -> Card:
        """
        Deal a card to a hand and notify callback if face-up.
        
        Args:
            hand: The hand to deal to.
            face_up: Whether the card is visible.
        
        Returns:
            The dealt card.
        """
        card = self.shoe.deal()
        hand.add_card(card)
        
        if face_up and self.on_card_exposed:
            self.on_card_exposed(card)
        
        return card
    
    def _deal_to_dealer(self, face_up: bool = True) -> Card:
        """Deal a card to the dealer."""
        card = self.shoe.deal()
        self.dealer.receive_card(card, face_up)
        
        if face_up and self.on_card_exposed:
            self.on_card_exposed(card)
        
        return card
    
    def start_round(self, bet: Optional[float] = None) -> Tuple[Hand, Card]:
        """
        Start a new round by dealing initial cards.
        
        Deal order (standard blackjack):
        1. Player card 1 (face up)
        2. Dealer card 1 (face up - the upcard)
        3. Player card 2 (face up)
        4. Dealer card 2 (face down - the hole card)
        
        Args:
            bet: Bet amount for this round.
        
        Returns:
            Tuple of (player's hand, dealer's upcard).
        """
        # Check if reshuffle needed
        if self.shoe.needs_shuffle:
            self.shoe.shuffle()
            # Burn one card after shuffle (visible to counter)
            burned = self.shoe.burn(1)
            if burned and self.on_card_exposed:
                self.on_card_exposed(burned[0])
        
        # Create new hands
        player_hand = self.player.new_hand(bet)
        self.dealer.new_hand()
        
        # Deal initial cards
        self._deal_card(player_hand, face_up=True)      # Player 1
        self._deal_to_dealer(face_up=True)              # Dealer upcard
        self._deal_card(player_hand, face_up=True)      # Player 2
        self._deal_to_dealer(face_up=False)             # Dealer hole card (NOT counted yet)
        
        self._round_in_progress = True
        
        return player_hand, self.dealer.upcard
    
    def get_available_actions(self, hand_index: int = 0) -> List[Action]:
        """
        Get the list of available actions for a hand.
        
        Args:
            hand_index: Index of the hand to check.
        
        Returns:
            List of valid Action enums.
        """
        if hand_index >= len(self.player.hands):
            return []
        
        hand = self.player.hands[hand_index]
        actions = []
        
        if hand.can_hit:
            actions.append(Action.HIT)
        if hand.can_stand:
            actions.append(Action.STAND)
        if hand.can_double and self.player.bankroll >= hand.bet:
            actions.append(Action.DOUBLE)
        if hand.can_split and self.player.can_split and self.player.bankroll >= hand.bet:
            actions.append(Action.SPLIT)
        if hand.can_surrender:
            actions.append(Action.SURRENDER)
        
        return actions
    
    def execute_action(self, action: Action, hand_index: int = 0) -> Optional[Card]:
        """
        Execute a player action on a hand.
        
        Args:
            action: The action to take.
            hand_index: Index of the hand to act on.
        
        Returns:
            The card dealt (for HIT/DOUBLE), or None.
        
        Raises:
            ValueError: If the action is not valid for this hand.
        """
        hand = self.player.hands[hand_index]
        
        if action == Action.HIT:
            if not hand.can_hit:
                raise ValueError("Cannot hit on this hand")
            return self._deal_card(hand, face_up=True)
        
        elif action == Action.STAND:
            if not hand.can_stand:
                raise ValueError("Cannot stand on this hand")
            hand.stand()
            return None
        
        elif action == Action.DOUBLE:
            if not hand.can_double:
                raise ValueError("Cannot double on this hand")
            self.player.double_down(hand_index)
            card = self._deal_card(hand, face_up=True)
            # After double, player must stand (status already set to DOUBLED)
            hand.status = HandStatus.STOOD
            return card
        
        elif action == Action.SPLIT:
            if not hand.can_split:
                raise ValueError("Cannot split this hand")
            hand1, hand2 = self.player.split_hand(hand_index)
            # Deal one card to each split hand
            self._deal_card(hand1, face_up=True)
            self._deal_card(hand2, face_up=True)
            return None
        
        elif action == Action.SURRENDER:
            if not hand.can_surrender:
                raise ValueError("Cannot surrender this hand")
            self.player.surrender_hand(hand_index)
            return None
        
        raise ValueError(f"Unknown action: {action}")
    
    def play_dealer(self) -> None:
        """
        Execute dealer's turn.
        
        Reveals the hole card (triggering count update) and plays
        according to H17/S17 rules.
        """
        # First, reveal the hole card
        hole_card = self.dealer.reveal_hole_card()
        if hole_card and self.on_card_exposed:
            self.on_card_exposed(hole_card)
        
        # Dealer plays (hits until should_hit returns False)
        def deal_callback() -> Card:
            card = self.shoe.deal()
            self.dealer.receive_card(card)
            if self.on_card_exposed:
                self.on_card_exposed(card)
            return card
        
        self.dealer.play(deal_callback)
    
    def check_early_blackjack(self) -> Optional[RoundSummary]:
        """
        Check for early blackjack resolution.
        
        If player or dealer has blackjack, the round may end immediately.
        Dealer peeks at hole card when showing Ace or 10.
        
        Returns:
            RoundSummary if round ended early, None otherwise.
        """
        player_hand = self.player.hands[0]
        dealer_upcard = self.dealer.upcard
        
        # Only check if player has blackjack or dealer showing Ace/10
        player_bj = player_hand.is_blackjack
        dealer_might_have_bj = dealer_upcard.is_ace or dealer_upcard.is_ten_value
        
        if player_bj or dealer_might_have_bj:
            # Peek at dealer's hole card
            dealer_bj = self.dealer.hand.is_blackjack
            
            if dealer_bj:
                # Reveal hole card now for blackjack
                hole_card = self.dealer.reveal_hole_card()
                if hole_card and self.on_card_exposed:
                    self.on_card_exposed(hole_card)
                
                if player_bj:
                    # Both have blackjack: push
                    self.player.receive_payout(player_hand.bet)
                    return self._create_summary([
                        HandResult(player_hand, RoundResult.PUSH, 0)
                    ])
                else:
                    # Only dealer has blackjack: player loses
                    return self._create_summary([
                        HandResult(player_hand, RoundResult.LOSE, -player_hand.bet)
                    ])
            
            elif player_bj:
                # Only player has blackjack: player wins
                payout = player_hand.bet * self.blackjack_payout
                self.player.receive_payout(player_hand.bet + payout)
                # Reveal hole card for completeness
                hole_card = self.dealer.reveal_hole_card()
                if hole_card and self.on_card_exposed:
                    self.on_card_exposed(hole_card)
                return self._create_summary([
                    HandResult(player_hand, RoundResult.BLACKJACK, payout)
                ])
        
        return None  # No early resolution
    
    def resolve_round(self) -> RoundSummary:
        """
        Resolve all player hands against the dealer.
        
        Should be called after all player hands are complete and
        dealer has played.
        
        Returns:
            RoundSummary with all hand results and payouts.
        """
        self._round_in_progress = False
        dealer_value = self.dealer.final_value
        dealer_busted = self.dealer.is_busted
        
        hand_results = []
        
        for hand in self.player.hands:
            if hand.status == HandStatus.SURRENDERED:
                # Already handled in surrender action
                hand_results.append(
                    HandResult(hand, RoundResult.SURRENDER, -hand.bet / 2)
                )
                continue
            
            if hand.is_busted:
                # Player busted: loses bet (already deducted)
                hand_results.append(
                    HandResult(hand, RoundResult.LOSE, -hand.bet)
                )
                continue
            
            player_value = hand.value
            
            if dealer_busted:
                # Dealer busted: player wins
                self.player.receive_payout(hand.bet * 2)
                hand_results.append(
                    HandResult(hand, RoundResult.WIN, hand.bet)
                )
            elif player_value > dealer_value:
                # Player has higher value
                self.player.receive_payout(hand.bet * 2)
                hand_results.append(
                    HandResult(hand, RoundResult.WIN, hand.bet)
                )
            elif player_value < dealer_value:
                # Dealer has higher value
                hand_results.append(
                    HandResult(hand, RoundResult.LOSE, -hand.bet)
                )
            else:
                # Push: return bet
                self.player.receive_payout(hand.bet)
                hand_results.append(
                    HandResult(hand, RoundResult.PUSH, 0)
                )
        
        return self._create_summary(hand_results)
    
    def _create_summary(self, hand_results: List[HandResult]) -> RoundSummary:
        """Create a round summary from hand results."""
        total = sum(hr.payout for hr in hand_results)
        return RoundSummary(
            player_hands=hand_results,
            dealer_hand=self.dealer.hand,
            total_payout=total
        )
    
    @property
    def needs_shuffle(self) -> bool:
        """Check if shoe needs to be shuffled before next round."""
        return self.shoe.needs_shuffle
