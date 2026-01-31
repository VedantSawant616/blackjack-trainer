#!/usr/bin/env python3
"""
main.py - CLI entry point for Blackjack Counting Trainer.

This is the main entry point for the training application.
Run with: python src/main.py
"""

import os
import sys
import time
from typing import Optional

# Add src to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import AppConfig, GameConfig, TrainingConfig
from src.game.shoe import Shoe
from src.game.player import Player
from src.game.dealer import Dealer, DealerRule
from src.game.engine import GameEngine, Action
from src.counting.counter import Counter
from src.strategy.basic_strategy import BasicStrategy, Decision
from src.training.drills import CountingDrill, FullPlayDrill
from src.stats.tracker import SessionTracker


def clear_screen():
    """Clear the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')


def print_header():
    """Print the application header."""
    print("""
╔═══════════════════════════════════════════════════╗
║       BLACKJACK COUNTING TRAINER                  ║
║       Single Deck | Hi-Lo System                  ║
╚═══════════════════════════════════════════════════╝
    """)


def print_menu():
    """Print the main menu."""
    print("""
┌─────────────────────────────────────┐
│  TRAINING MODES                     │
├─────────────────────────────────────┤
│  1. Counting Drill                  │
│  2. Full Play (Training Mode)       │
│  3. Settings                        │
│  4. View Statistics                 │
│  5. Exit                            │
└─────────────────────────────────────┘
""")


def get_input(prompt: str, valid_options: Optional[list] = None) -> str:
    """Get user input with optional validation."""
    while True:
        try:
            value = input(prompt).strip()
            if valid_options is None or value in valid_options:
                return value
            print(f"Invalid option. Choose from: {', '.join(valid_options)}")
        except (EOFError, KeyboardInterrupt):
            print("\n")
            return "quit"


def counting_drill_mode(config: AppConfig, tracker: SessionTracker):
    """
    Run the counting drill mode.
    
    Shows cards and asks for running count.
    """
    clear_screen()
    print("\n=== COUNTING DRILL ===\n")
    print("Cards will be shown. Enter the running count after each round.")
    print("Type 'q' to quit.\n")
    
    drill = CountingDrill(cards_per_round=config.training.cards_per_drill)
    drill.reset()
    tracker.start_session("counting")
    
    round_num = 0
    
    while True:
        round_num += 1
        
        # Deal cards
        cards, correct_count = drill.deal_cards()
        
        # Show cards
        cards_display = " ".join(str(c) for c in cards)
        print(f"Round {round_num}: {cards_display}")
        
        # Get user input
        start_time = time.time()
        answer = get_input("Running Count: ")
        response_time = (time.time() - start_time) * 1000
        
        if answer.lower() in ('q', 'quit'):
            break
        
        try:
            user_count = int(answer)
        except ValueError:
            print("Please enter a number.\n")
            continue
        
        # Check answer
        result = drill.check_answer(cards, correct_count, user_count, response_time)
        tracker.record_counting_result(result)
        
        if result.is_correct:
            print(f"✓ Correct! RC = {correct_count:+d}")
        else:
            print(f"✗ Wrong. RC = {correct_count:+d} (you said {user_count:+d})")
        
        print(f"   Streak: {drill.current_streak} | Accuracy: {drill.accuracy:.1%}\n")
        
        # Check if reshuffle needed
        if drill.shoe.needs_shuffle:
            print("--- SHUFFLE ---\n")
            drill.reset()
    
    # End session
    stats = tracker.end_session()
    print("\n" + tracker.get_session_summary())
    input("\nPress Enter to continue...")


def full_play_mode(config: AppConfig, tracker: SessionTracker):
    """
    Run full play training mode.
    
    Complete blackjack hands with strategy verification.
    """
    clear_screen()
    print("\n=== FULL PLAY MODE ===\n")
    print("Play blackjack hands. Strategy decisions will be checked.")
    print("Type 'q' to quit.\n")
    
    # Initialize game components
    shoe = Shoe(penetration=config.game.penetration)
    player = Player(bankroll=config.training.starting_bankroll, base_bet=config.training.base_bet)
    dealer = Dealer(rule=config.game.dealer_rule)
    counter = Counter()
    strategy = BasicStrategy(dealer_rule=config.game.dealer_rule)
    
    engine = GameEngine(
        shoe=shoe,
        player=player,
        dealer=dealer,
        on_card_exposed=lambda c: counter.count_card(c)
    )
    
    tracker.start_session("full_play")
    hand_num = 0
    
    while True:
        hand_num += 1
        
        # Check for reshuffle
        if shoe.needs_shuffle:
            print("\n--- SHUFFLE ---\n")
            shoe.shuffle()
            counter.reset()
        
        # Check bankroll
        if player.bankroll < config.training.base_bet:
            print("\nBankroll depleted. Session over.")
            break
        
        # Start hand
        print(f"\n─── Hand #{hand_num} ─── Bankroll: ${player.bankroll:.2f}")
        
        try:
            player_hand, dealer_upcard = engine.start_round()
        except Exception as e:
            print(f"Error starting round: {e}")
            break
        
        print(f"Dealer shows: {dealer_upcard}")
        print(f"Your hand:    {player_hand}")
        
        # Check for early blackjack
        early_result = engine.check_early_blackjack()
        if early_result:
            print(f"\n{early_result}")
            continue
        
        # Player's turn
        while player.active_hand is not None:
            current_hand = player.active_hand
            hand_idx = player.active_hand_index
            
            print(f"\nHand: {current_hand}")
            
            # Get available actions
            actions = engine.get_available_actions(hand_idx)
            action_str = " / ".join(a.value.upper()[0] for a in actions)
            
            # Get correct action
            correct = strategy.get_decision(
                current_hand, 
                dealer_upcard,
                can_double=Action.DOUBLE in actions,
                can_split=Action.SPLIT in actions,
                can_surrender=Action.SURRENDER in actions
            )
            
            # Prompt for action
            prompt = f"Action ({action_str}): "
            answer = get_input(prompt)
            
            if answer.lower() in ('q', 'quit'):
                tracker.end_session()
                print("\n" + tracker.get_session_summary())
                input("\nPress Enter to continue...")
                return
            
            # Parse action
            action_map = {
                'h': Action.HIT,
                's': Action.STAND,
                'd': Action.DOUBLE,
                'p': Action.SPLIT,
                'r': Action.SURRENDER,
            }
            
            user_action = action_map.get(answer.lower())
            if user_action is None or user_action not in actions:
                print(f"Invalid action. Choose from: {action_str}")
                continue
            
            # Check if action is correct
            is_correct = _check_action(user_action, correct)
            
            if not is_correct and config.training.show_correct_action:
                print(f"   ⚠ Basic strategy says: {correct.value}")
            
            # Execute action
            try:
                engine.execute_action(user_action, hand_idx)
            except ValueError as e:
                print(f"Error: {e}")
                continue
        
        # Dealer's turn (if player hasn't busted all hands)
        all_busted = all(h.is_busted for h in player.hands)
        if not all_busted:
            print(f"\nDealer reveals: ", end="")
            engine.play_dealer()
            print(f"{dealer.hand}")
        
        # Resolve and show results
        result = engine.resolve_round()
        print(f"\n{result}")
        
        # Quiz running count occasionally
        if hash(hand_num) % 3 == 0:  # Roughly 1/3 of hands
            rc_answer = get_input("\nRunning Count? ")
            try:
                user_rc = int(rc_answer)
                if user_rc == counter.running_count:
                    print(f"✓ Correct! RC = {counter.running_count:+d}")
                else:
                    print(f"✗ RC = {counter.running_count:+d}")
            except ValueError:
                pass
    
    # End session
    stats = tracker.end_session()
    print("\n" + tracker.get_session_summary())
    input("\nPress Enter to continue...")


def _check_action(user_action: Action, correct: Decision) -> bool:
    """Check if user action matches basic strategy."""
    action_to_decision = {
        Action.HIT: Decision.HIT,
        Action.STAND: Decision.STAND,
        Action.DOUBLE: Decision.DOUBLE,
        Action.SPLIT: Decision.SPLIT,
        Action.SURRENDER: Decision.SURRENDER_HIT,
    }
    
    user_decision = action_to_decision.get(user_action)
    
    if correct == Decision.DOUBLE_STAND:
        return user_decision in (Decision.DOUBLE, Decision.STAND)
    if correct == Decision.SURRENDER_HIT:
        return user_decision in (Decision.SURRENDER_HIT, Decision.HIT)
    
    return user_decision == correct


def settings_menu(config: AppConfig) -> AppConfig:
    """Display and modify settings."""
    while True:
        clear_screen()
        print("\n=== SETTINGS ===\n")
        print(config)
        print("""
┌─────────────────────────────────────┐
│  1. Toggle Dealer Rule (H17/S17)    │
│  2. Set Penetration                 │
│  3. Set Cards Per Drill             │
│  4. Back to Main Menu               │
└─────────────────────────────────────┘
""")
        
        choice = get_input("Select: ", ["1", "2", "3", "4"])
        
        if choice == "1":
            if config.game.dealer_rule == DealerRule.H17:
                config.game.dealer_rule = DealerRule.S17
                print("Changed to S17 (dealer stands on soft 17)")
            else:
                config.game.dealer_rule = DealerRule.H17
                print("Changed to H17 (dealer hits soft 17)")
            input("Press Enter to continue...")
        
        elif choice == "2":
            pen_str = get_input("Penetration (50-90): ")
            try:
                pen = int(pen_str)
                if 50 <= pen <= 90:
                    config.game.penetration = pen / 100
                    print(f"Penetration set to {pen}%")
                else:
                    print("Must be between 50 and 90")
            except ValueError:
                print("Invalid number")
            input("Press Enter to continue...")
        
        elif choice == "3":
            cards_str = get_input("Cards per drill (1-10): ")
            try:
                cards = int(cards_str)
                if 1 <= cards <= 10:
                    config.training.cards_per_drill = cards
                    print(f"Cards per drill set to {cards}")
                else:
                    print("Must be between 1 and 10")
            except ValueError:
                print("Invalid number")
            input("Press Enter to continue...")
        
        elif choice == "4":
            break
    
    return config


def view_statistics(tracker: SessionTracker):
    """View historical statistics."""
    clear_screen()
    print("\n=== STATISTICS ===\n")
    
    if tracker.current_session:
        print("Current Session:")
        print(tracker.get_session_summary())
        print()
    
    print("Historical:")
    print(tracker.get_historical_summary())
    
    input("\nPress Enter to continue...")


def main():
    """Main entry point."""
    config = AppConfig.default()
    tracker = SessionTracker()
    
    while True:
        clear_screen()
        print_header()
        print_menu()
        
        choice = get_input("Select mode: ", ["1", "2", "3", "4", "5", "q"])
        
        if choice == "1":
            counting_drill_mode(config, tracker)
        elif choice == "2":
            full_play_mode(config, tracker)
        elif choice == "3":
            config = settings_menu(config)
        elif choice == "4":
            view_statistics(tracker)
        elif choice in ("5", "q"):
            print("\nGood luck at the tables!\n")
            break


if __name__ == "__main__":
    main()
