package s3

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"os"
	"path/filepath"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Bucket holds every object the API serves back to clients.
const Bucket = "project-achiles"

// uploadWorkers bounds how many PutObjects are in flight at once. The seed set
// is a handful of objects and the bottleneck is home upstream bandwidth, not
// S3, so this is about overlapping TLS handshakes and request signing rather
// than about throughput.
const uploadWorkers = 4

// contentTypes fills the gaps in Go's mime table. On Windows
// mime.TypeByExtension reads the registry, where .avif is usually absent and
// .jpg is not guaranteed — and an object stored with no Content-Type is served
// as binary/octet-stream, which leaves the browser sniffing.
var contentTypes = map[string]string{
	".avif": "image/avif",
	".jpeg": "image/jpeg",
	".jpg":  "image/jpeg",
	".png":  "image/png",
	".webp": "image/webp",
}

// SetUp seeds the project bucket from a map of object key to local file path.
//
// Objects already in the bucket at the same byte length are SKIPPED. That is
// what keeps a restart cheap: the art changes about once a release, but this
// runs on every boot, and re-pushing every megabyte of it each time is how a
// ten-second budget got blown in the first place. A HEAD per key costs one
// small round trip; a PUT costs the whole file.
//
// A key whose HEAD fails for any reason is treated as absent and uploaded. The
// failure modes worth separating here — missing object, expired credentials,
// no network — all end up reported by the PUT that follows, with a better
// message than a HEAD would give.
func SetUp(ctx context.Context, filePaths map[string]string) error {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-east-1"))
	if err != nil {
		return fmt.Errorf("loading aws config: %w", err)
	}
	svc := s3.NewFromConfig(cfg)

	// Decide what actually needs sending before sending anything, so the log
	// line below can state the real size of the job up front.
	type job struct {
		key  string
		path string
		size int64
	}
	var (
		pending []job
		skipped int
		total   int64
	)

	for key, path := range filePaths {
		info, err := os.Stat(path)
		if err != nil {
			return fmt.Errorf("reading %s for key %s: %w", path, key, err)
		}
		if uploaded(ctx, svc, key, info.Size()) {
			skipped++
			continue
		}
		pending = append(pending, job{key: key, path: path, size: info.Size()})
		total += info.Size()
	}

	if len(pending) == 0 {
		slog.Info("s3: bucket already seeded", "objects", skipped)
		return nil
	}
	slog.Info("s3: seeding bucket",
		"upload", len(pending), "skip", skipped, "bytes", total)

	var (
		wg   sync.WaitGroup
		sem  = make(chan struct{}, uploadWorkers)
		mu   sync.Mutex
		errs []error
	)
	for _, j := range pending {
		wg.Add(1)
		go func(j job) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			if err := put(ctx, svc, j.key, j.path); err != nil {
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
				return
			}
			slog.Info("s3: uploaded", "key", j.key, "bytes", j.size)
		}(j)
	}
	wg.Wait()

	return errors.Join(errs...)
}

// uploaded reports whether key is already in the bucket at exactly size bytes.
// Length is a coarse check, but the seed set is whole files replaced wholesale
// — a same-size different-image swap is not a thing that happens here, and the
// alternative is hashing every file on every boot.
func uploaded(ctx context.Context, svc *s3.Client, key string, size int64) bool {
	head, err := svc.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(Bucket),
		Key:    aws.String(key),
	})
	if err != nil || head.ContentLength == nil {
		return false
	}
	return *head.ContentLength == size
}

// put uploads one file. Split out of the loop so the handle closes when THIS
// upload finishes rather than when the whole batch does — a `defer` inside the
// range loop held every file open until SetUp returned.
func put(ctx context.Context, svc *s3.Client, key, path string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("opening %s: %w", path, err)
	}
	defer file.Close()

	_, err = svc.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(Bucket),
		Key:    aws.String(key),
		Body:   file,
		// Taken from the LOCAL file's extension, not the key's. They disagree
		// on purpose in places — `athlete.jpg` currently holds PNG bytes — and
		// the bytes are what the browser has to decode.
		ContentType: aws.String(contentType(path)),
	})
	if err != nil {
		return fmt.Errorf("uploading %s: %w", key, err)
	}
	return nil
}

func contentType(path string) string {
	ext := filepath.Ext(path)
	if t, ok := contentTypes[ext]; ok {
		return t
	}
	if t := mime.TypeByExtension(ext); t != "" {
		return t
	}
	return "application/octet-stream"
}
