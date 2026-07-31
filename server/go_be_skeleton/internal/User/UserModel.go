package user

type User struct {
	Id        int     `json:"id"`
	Name      string  `json:"name"`
	Age       int     `json:"age"`
	Weight    float64 `json:"weight"`
	Gender    string  `json:"gender"`
	Height_cm float64 `json:"height_cm"`
	// User_specs Specs   `json:"user_specs,omitempty"`
}

type Specs struct {
	U_Bmi          BMI
	U_Bmr          BMR
	U_water_intake float64 `json:"water_intake,omitempty"`
	Verdict        string  `json:"verdict,omitempty"`
}

type BMI struct {
	Bmi_value float64 `json:"bmi,omitempty"`
}
type BMR struct {
	Bmr_value float64 `json:"bmr,omitempty"`
}
