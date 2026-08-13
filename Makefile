.PHONY: dev server client

dev:
	@trap 'kill 0' SIGINT; \
	$(MAKE) server & \
	$(MAKE) client & \
	wait

server:
	cd server && python3 main.py

client:
	cd client && pnpm run dev