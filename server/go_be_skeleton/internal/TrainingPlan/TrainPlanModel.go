// Package trainingplan stores the catalogue of training plans and the S3
// keys of their cover images.
package trainingplan

import (
	"fmt"
	"net/url"
)

// TrainingPlan is one row of training_plans.
//
// Two pieces of art per plan, and they are not interchangeable:
//
//	ImageKey     the COVER — a portrait crop that has to read at 248px on the
//	             picker's cylinder cards and as the card thumbnail.
//	WatermarkKey the BACKDROP — full-bleed art the app blows up across the
//	             viewport behind every screen. A cover upscaled to that size is
//	             a blurry mess, which is why it is a separate object rather
//	             than the same key at a different opacity.
//
// Both are bare S3 object keys such as "spartan.jpg". The *URL fields are
// derived from them for the client and never scanned, hence db:"-"; omitempty
// keeps them out of payloads where they mean nothing.
type TrainingPlan struct {
	ID           int    `json:"id"            db:"id"`
	Name         string `json:"name"          db:"name"`
	Slug         string `json:"slug"          db:"slug"`
	Description  string `json:"description"   db:"description"`
	ImageKey     string `json:"image_key"     db:"image_key"`
	WatermarkKey string `json:"watermark_key" db:"watermark_key"`
	ImageURL     string `json:"image_url,omitempty"     db:"-"`
	WatermarkURL string `json:"watermark_url,omitempty" db:"-"`
}

// PlanDetails is the half of a plan that arrives in the request body. The
// image half is not accepted from clients — it is looked up in PlanAssets by
// Slug, so a request cannot point a plan at an arbitrary S3 object.
type PlanDetails struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
}

// PlanAsset ties a plan's slug to the two S3 objects illustrating it and to
// the local files those objects are seeded from.
//
// The *Path fields are paths on the server's disk, not something a browser can
// fetch; the client-facing URLs are built from the bucket plus the keys by
// ResolveURLs.
type PlanAsset struct {
	Slug string

	// Cover art, shown on the picker cards.
	ImageKey  string
	LocalPath string

	// Full-bleed backdrop, faded in behind the app. A plan with no watermark
	// is legal: both fields empty means the client falls back to the cover,
	// which is what it did before these existed.
	WatermarkKey  string
	WatermarkPath string
}

// PlanAssets is the canonical art table. main.go seeds S3 from it and AddPlans
// reads keys out of it, so an upload and an insert cannot disagree about what
// a plan's images are called.
//
// The *Watermark source files are deliberately much larger than the covers:
// they are stretched across the whole viewport, so an upscale artefact that is
// invisible on a 248px card is a smear at 1920px.
var PlanAssets = []PlanAsset{
	{
		Slug:     "athlete",
		ImageKey: "athlete.jpg", LocalPath: `assets\athleteThumbnail.png`,
		WatermarkKey: "athlete_watermark.jpg", WatermarkPath: `assets\athleteWatermark.png`,
	},
	{
		Slug:     "manga",
		ImageKey: "manga.jpg", LocalPath: `assets\mangaThumbnail.png`,
		WatermarkKey: "manga_watermark.jpg", WatermarkPath: `assets\mangaWatermark.png`,
	},
	{
		// Was assets\greek.jpg, which no longer exists on disk. s3.SetUp
		// returns on the first os.Open failure and main.go bails out before
		// the HTTP server starts, so a stale path here is a boot failure for
		// the whole API, not a missing picture.
		Slug:     "greek-god",
		ImageKey: "greek_god.png", LocalPath: `assets\greekThumbnail.png`,
		WatermarkKey: "greek_god_watermark.jpg", WatermarkPath: `assets\greekWatermark.png`,
	},
	{
		Slug:     "spartan",
		ImageKey: "spartan.jpg", LocalPath: `assets\spartanThumbnail.png`,
		// AVIF: every browser this app supports decodes it, and it is the one
		// backdrop small enough to stay under 60KB at full bleed.
		WatermarkKey: "spartan_watermark.avif", WatermarkPath: `assets\spartanWatermark.avif`,
	},
	{
		Slug:     "superhero",
		ImageKey: "superhero.jpg", LocalPath: `assets\superheroThumbnail.png`,
		WatermarkKey: "superhero_watermark.jpg", WatermarkPath: `assets\superheroWatermark.jpg`,
	},
}

// UploadMap returns PlanAssets in the shape s3.SetUp expects: object key to
// local file path. Covers and watermarks share the map — they are objects in
// the same bucket and only their keys tell them apart.
func UploadMap() map[string]string {
	out := make(map[string]string, len(PlanAssets)*2)
	for _, a := range PlanAssets {
		out[a.ImageKey] = a.LocalPath
		// Guarded so a plan can ship without a backdrop rather than seeding an
		// empty key, which S3 would reject.
		if a.WatermarkKey != "" && a.WatermarkPath != "" {
			out[a.WatermarkKey] = a.WatermarkPath
		}
	}
	return out
}

// AssetFor returns the art illustrating slug. Linear scan — PlanAssets is a
// handful of entries and this runs once per submitted plan.
func AssetFor(slug string) (PlanAsset, bool) {
	for _, a := range PlanAssets {
		if a.Slug == slug {
			return a, true
		}
	}
	return PlanAsset{}, false
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

// ResolveURLs fills ImageURL and WatermarkURL from their keys. Call it on the
// way out to the client, not before writing — the insert only ever stores the
// keys.
//
// An empty key yields an empty URL rather than a bucket root, so `omitempty`
// drops the field and the client can tell "no art" from "art at this address".
func (p *TrainingPlan) ResolveURLs(bucket string) {
	p.ImageURL = objectURL(bucket, p.ImageKey)
	p.WatermarkURL = objectURL(bucket, p.WatermarkKey)
}

func objectURL(bucket, key string) string {
	if key == "" {
		return ""
	}
	return fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucket, url.PathEscape(key))
}

// NutritionTemplate is the basic nutrition guidance attached to a plan —
// one per plan, authored once and shown to every user on that plan.
type NutritionTemplate struct {
	ID              int     `json:"id"`
	TrainingPlanID  int     `json:"training_plan_id"`
	CalorieGuidance string  `json:"calorie_guidance"`
	ProteinPct      float64 `json:"protein_pct"`
	CarbsPct        float64 `json:"carbs_pct"`
	FatsPct         float64 `json:"fats_pct"`
	MealFrequency   int     `json:"meal_frequency"`
	Notes           string  `json:"notes,omitempty"`
}

// WorkoutTemplate is one training day (e.g. "Push Day") within a plan.
type WorkoutTemplate struct {
	ID             int                `json:"id"`
	TrainingPlanID int                `json:"training_plan_id"`
	SplitName      string             `json:"split_name"`
	DayOrder       int                `json:"day_order"`
	Notes          string             `json:"notes,omitempty"`
	Exercises      []*WorkoutExercise `json:"exercises,omitempty"`
}

// WorkoutExercise is one movement within a WorkoutTemplate.
type WorkoutExercise struct {
	ID                int    `json:"id"`
	WorkoutTemplateID int    `json:"workout_template_id"`
	Name              string `json:"name"`
	Sets              int    `json:"sets"`
	Reps              string `json:"reps"`
	RestSeconds       int    `json:"rest_seconds"`
	ExerciseOrder     int    `json:"exercise_order"`
}

// Dashboard aggregates everything a user's dashboard needs once they've
// selected a plan: the plan itself (with art resolved), its nutrition
// template, and its workout templates with exercises nested in.
type Dashboard struct {
	Plan      TrainingPlan       `json:"plan"`
	Nutrition *NutritionTemplate `json:"nutrition,omitempty"`
	Workouts  []*WorkoutTemplate `json:"workouts,omitempty"`
}
