package connect

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"

	// "github.com/woojiahao/go_redis/internal/utility"
	"log"
)

func RunRedis() {
	ctx := context.Background()

	// Ensure that you have Redis running on your system
	rdb := redis.NewClient(&redis.Options{

		Addr:     Address(),
		Password: Password(), // no password set
		DB:       Database(), // use default DB
	})

	// Ensure that the connection is properly closed gracefully
	defer rdb.Close()

	// Perform basic diagnostic to check if the connection is working
	// Expected result > ping: PONG
	// If Redis is not running, error case is taken instead
	status, err := rdb.Ping(ctx).Result()

	if err != nil {
		log.Fatalln("Redis connection was refused")
	}
	fmt.Println(status)
	fmt.Println("Running")
}

func AddCache(rdb *redis.Client, data string, ctx context.Context) {

	_, err := rdb.Set(ctx, "cachedResponse", data, 0).Result()
	if err != nil {
		fmt.Println("Failed to add cahced data due to : ", err)
		return
	}
}
func GetCache(rdb *redis.Client, ctx context.Context) (string, error) {

	result, err := rdb.Get(ctx, "cachedResponse").Result()
	if err != nil {
		return "", fmt.Errorf("eror in fetching cached resp %w", err)
	}

	return result, nil
}
