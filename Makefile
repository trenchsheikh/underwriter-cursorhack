.PHONY: help install dev run test lint format docker-build docker-up docker-down

help:
	@echo "Targets:"
	@echo "  install       Install runtime dependencies"
	@echo "  dev           Install dev dependencies"
	@echo "  run           Run API locally with uvicorn (reload)"
	@echo "  test          Run pytest"
	@echo "  lint          Run ruff lint check"
	@echo "  format        Run ruff format"
	@echo "  docker-build  Build the API docker image"
	@echo "  docker-up     Start db + api via docker compose"
	@echo "  docker-down   Stop docker compose stack"

install:
	pip install -r requirements.txt

dev:
	pip install -r requirements-dev.txt

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	pytest

lint:
	ruff check .

format:
	ruff format .

docker-build:
	docker build -t underwriter-api:local .

docker-up:
	docker compose up --build

docker-down:
	docker compose down
