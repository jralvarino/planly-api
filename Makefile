.PHONY: build-CategoryLambdaFunction build-HabitLambdaFunction build-TodoLambdaFunction build-StatsMidnightLambdaFunction

build-CategoryLambdaFunction build-HabitLambdaFunction build-TodoLambdaFunction build-StatsMidnightLambdaFunction:
	cp -r dist $(ARTIFACTS_DIR)/
	cp package.json package-lock.json $(ARTIFACTS_DIR)/
	cd $(ARTIFACTS_DIR) && npm ci --omit=dev
