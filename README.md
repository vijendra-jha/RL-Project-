# RL Stock Trading Lab

A complete browser-based Reinforcement Learning stock-trading simulator built with **HTML, CSS and JavaScript**.

## Features
- Synthetic NIFTY-style market price graph
- Working BUY and SELL paper-trading buttons
- Cash, shares and portfolio-value tracking
- Q-learning agent
- Adjustable learning rate, discount factor and exploration
- Training progress bar
- Reward graph
- Agent BUY / SELL / HOLD decisions
- Agent return, win rate and maximum drawdown
- Responsive modern dashboard
- Runs locally without a backend

## Run
1. Extract the ZIP.
2. Open `index.html` in Chrome/Edge/Firefox.
3. Click **TRAIN AGENT**.
4. Click **RUN AGENT ON CHART**.
5. Use **BUY** and **SELL** for manual paper trading.

## RL concept
State = market trend + portfolio position  
Actions = BUY / SELL / HOLD  
Reward = change in simulated portfolio value  
Algorithm = Q-learning

## Important
This is an educational simulator using generated market data. It does not connect to a broker, place real trades, or predict real market prices.
