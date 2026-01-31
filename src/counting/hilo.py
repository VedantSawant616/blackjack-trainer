"""
hilo.py - Hi-Lo card counting system values.

PURPOSE:
    Defines the Hi-Lo counting system tag values.
    This is the reference for how each card affects the count.

RESPONSIBILITIES:
    - Provide tag value (+1, 0, -1) for each rank
    - Document the Hi-Lo system theory

MUST NOT:
    - Track the running count (counter module does this)
    - Know about cards dealt (pure reference)
"""

from ..game.deck import Rank, Card

# Hi-Lo Tag Values
#
# Theory: Low cards (2-6) favor the dealer because:
#   - Dealer must hit until 17, less likely to bust with low cards
#   - Player gets fewer blackjacks
#
# High cards (10-A) favor the player because:
#   - More blackjacks (3:2 payout)
#   - Dealer more likely to bust
#   - Better doubling opportunities
#
# When low cards leave the deck, count goes UP (+1)
# When high cards leave the deck, count goes DOWN (-1)

HILO_VALUES: dict[Rank, int] = {
    Rank.TWO: +1,    # Low card removed = good for player
    Rank.THREE: +1,
    Rank.FOUR: +1,
    Rank.FIVE: +1,
    Rank.SIX: +1,
    Rank.SEVEN: 0,   # Neutral
    Rank.EIGHT: 0,
    Rank.NINE: 0,
    Rank.TEN: -1,    # High card removed = bad for player
    Rank.JACK: -1,
    Rank.QUEEN: -1,
    Rank.KING: -1,
    Rank.ACE: -1,
}


def get_hilo_value(card: Card) -> int:
    """
    Get the Hi-Lo tag value for a card.
    
    Args:
        card: The card to evaluate.
    
    Returns:
        +1 for 2-6, 0 for 7-9, -1 for 10-A.
    """
    return HILO_VALUES[card.rank]


def get_hilo_for_rank(rank: Rank) -> int:
    """
    Get the Hi-Lo tag value for a rank.
    
    Args:
        rank: The rank to evaluate.
    
    Returns:
        +1 for 2-6, 0 for 7-9, -1 for 10-A.
    """
    return HILO_VALUES[rank]


# Running count interpretation:
# RC > 0: Deck is rich in high cards (favorable to player)
# RC < 0: Deck is rich in low cards (favorable to dealer)
# RC = 0: Balanced deck
#
# True count = RC / decks remaining
# TC is used for:
#   - Bet sizing (higher TC = larger bet)
#   - Strategy deviations (index plays)
