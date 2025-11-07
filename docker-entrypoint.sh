#!/bin/bash
set -e

echo "Starting CertiChain Application..."

wait_for_blockchain() {
	echo "Waiting for blockchain connection..."
	max_attempts=30
	attempt=0

	while [ $attempt -lt $max_attempts ]; do
		if curl -s -X POST -H "Content-Type: application/json" \
			--data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
			$BLOCKCHAIN_URL >/dev/null 2>&1; then
			echo "Blockchain connection established"
			return 0
		fi
		attempt=$((attempt + 1))
		echo "Attempt $attempt/$max_attempts - waiting for blockchain..."
		sleep 2
	done

	echo "Error: Blockchain failed to start after $max_attempts attempts"
	exit 1
}

deploy_contract() {
	echo "Deploying smart contract..."
	cd /app/contracts

	npx hardhat run deploy.js --network localhost

	if [ -f "deployments/localhost.json" ]; then
		CONTRACT_ADDR=$(cat deployments/localhost.json | grep -o '"contractAddress":"[^"]*' | cut -d'"' -f4)
		echo "Contract deployed at: $CONTRACT_ADDR"
		export CONTRACT_ADDRESS=$CONTRACT_ADDR
		echo "CONTRACT_ADDRESS=$CONTRACT_ADDR" >/app/.env.contract
	else
		echo "Error: Deployment file not found"
		exit 1
	fi
}

start_backend() {
	echo "Starting backend server..."
	cd /app/backend

	if [ -f "/app/.env.contract" ]; then
		source /app/.env.contract
	fi

	./app &
	BACKEND_PID=$!
	echo "Backend server started (PID: $BACKEND_PID)"
}

start_frontend() {
	echo "Starting frontend server..."
	cd /app/frontend

	npx http-server -p $FRONTEND_PORT -a 0.0.0.0 --cors &
	FRONTEND_PID=$!
	echo "Frontend server started on port $FRONTEND_PORT (PID: $FRONTEND_PID)"
}

cleanup() {
	echo "Shutting down services..."
	if [ ! -z "$BACKEND_PID" ]; then
		kill $BACKEND_PID 2>/dev/null || true
	fi
	if [ ! -z "$FRONTEND_PID" ]; then
		kill $FRONTEND_PID 2>/dev/null || true
	fi
	echo "Shutdown complete"
	exit 0
}

trap cleanup SIGTERM SIGINT

main() {
	wait_for_blockchain

	if [ -z "$CONTRACT_ADDRESS" ]; then
		deploy_contract
	else
		echo "Using existing contract at: $CONTRACT_ADDRESS"
	fi

	start_backend
	start_frontend

	echo ""
	echo "CertiChain is ready"
	echo "Frontend: http://localhost:$FRONTEND_PORT"
	echo "Backend API: http://localhost:$PORT"
	echo "Blockchain RPC: $BLOCKCHAIN_URL"
	echo "Contract: $CONTRACT_ADDRESS"
	echo ""

	wait
}

main
