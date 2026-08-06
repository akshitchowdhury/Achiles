package s3

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Bucket holds every object the API serves back to clients.
const Bucket = "project-achiles"

// SetUp uploads filePath to the project bucket. key names the object; an
// empty key falls back to the file's base name.
func SetUp(ctx context.Context, filePaths map[string]string) error {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-east-1"))
	if err != nil {
		return fmt.Errorf("loading aws config: %w", err)
	}
	svc := s3.NewFromConfig(cfg)

	for key := range filePaths {
		bucket := Bucket
		if key == "" {
			key = filepath.Base(key)
		}

		file, err := os.Open(filePaths[key])
		if err != nil {
			return fmt.Errorf("opening %s: %w", filePaths, err)
		}
		defer file.Close()

		if _, err := svc.PutObject(ctx, &s3.PutObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
			Body:   file,
		}); err != nil {
			return fmt.Errorf("uploading %s: %w", key, err)

		}
	}
	return nil
}
