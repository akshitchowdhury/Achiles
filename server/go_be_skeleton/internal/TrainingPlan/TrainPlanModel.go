// Package trainingplan stores the catalogue of training plans and the S3
// keys of their cover images.
package trainingplan

import (
	"fmt"
	"net/url"
)

// TrainingPlan is one row of training_plans.
//
// ImageKey is the column — a bare S3 object key such as "spartan.jpg".
// ImageURL is derived from it for the client and never scanned, hence db:"-";
// omitempty keeps it out of payloads where it means nothing.
type TrainingPlan struct {
	ID          int    `json:"id"          db:"id"`
	Name        string `json:"name"        db:"name"`
	Slug        string `json:"slug"        db:"slug"`
	Description string `json:"description" db:"description"`
	ImageKey    string `json:"image_key"   db:"image_key"`
	ImageURL    string `json:"image_url,omitempty" db:"-"`
}

// PlanDetails is the half of a plan that arrives in the request body. The
// image half is not accepted from clients — it is looked up in PlanAssets by
// Slug, so a request cannot point a plan at an arbitrary S3 object.
type PlanDetails struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
}

// PlanAsset ties a plan's slug to the S3 object illustrating it and to the
// local file that object is seeded from.
//
// LocalPath is a path on the server's disk, not something a browser can fetch;
// the client-facing URL is built from the bucket plus ImageKey by
// ResolveImageURL.
type PlanAsset struct {
	Slug      string
	ImageKey  string
	LocalPath string
}

// PlanAssets is the canonical cover-image table. main.go seeds S3 from it and
// AddPlans reads image keys out of it, so an upload and an insert cannot
// disagree about what a plan's image is called.
var PlanAssets = []PlanAsset{
	{Slug: "athlete", ImageKey: "athlete.jpg", LocalPath: `assets\athlete.jpg`},
	{Slug: "manga", ImageKey: "manga.jpg", LocalPath: `assets\manga.jpg`},
	{Slug: "greek-god", ImageKey: "greek_god.png", LocalPath: `assets\greek.jpg`},
	// {Slug: "greek-god", ImageKey: "greek_god.png", LocalPath: `assets\Greek-god-2.png`},
	{Slug: "spartan", ImageKey: "spartan.jpg", LocalPath: `assets\spartanTwo.jpg`},
	{Slug: "superhero", ImageKey: "superhero.jpg", LocalPath: `assets\superhero.jpg`},
}

// UploadMap returns PlanAssets in the shape s3.SetUp expects: object key to
// local file path.
func UploadMap() map[string]string {
	out := make(map[string]string, len(PlanAssets))
	for _, a := range PlanAssets {
		out[a.ImageKey] = a.LocalPath
	}
	return out
}

// ImageKeyFor returns the S3 key illustrating slug. Linear scan — PlanAssets
// is a handful of entries and this runs once per submitted plan.
func ImageKeyFor(slug string) (string, bool) {
	for _, a := range PlanAssets {
		if a.Slug == slug {
			return a.ImageKey, true
		}
	}
	return "", false
}

// UnknownSlugError reports a submitted plan whose slug has no cover image in
// PlanAssets — usually a typo in the request body, or a new plan whose image
// has not been added to the table yet.
type UnknownSlugError struct {
	Slug string
}

func (e UnknownSlugError) Error() string {
	return fmt.Sprintf("trainingplan: no image asset for slug %q", e.Slug)
}

// ResolveImageURL fills ImageURL from ImageKey. Call it on the way out to the
// client, not before writing — the insert only ever stores the key.
func (p *TrainingPlan) ResolveImageURL(bucket string) {
	if p.ImageKey == "" {
		p.ImageURL = ""
		return
	}
	p.ImageURL = fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucket, url.PathEscape(p.ImageKey))
}
