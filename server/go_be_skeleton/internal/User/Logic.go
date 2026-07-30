package user

func CalculateBmi(u *User) int {

	var bmiVal BMI

	h := u.Height_cm
	w := u.Weight

	bmiVal.Bmi_value = (w / (h * h)) * 10000
	return int(bmiVal.Bmi_value)
}
func CalculateBmr(u *User) int {

	var bmrVal BMR

	if u.Gender == "Male" {
		bmrVal.Bmr_value = 13.397*(u.Weight) + 4.799*(u.Height_cm) - 5.677*(float64(u.Age)) + 88.362
	}

	bmrVal.Bmr_value = 9.247*(u.Weight) + 3.098*(u.Height_cm) - 4.330*(float64(u.Age)) + 447.593

	return int(bmrVal.Bmr_value)
}

func Get_User_verdict(bmi int) string {

	if bmi < 19 {
		return "Underweight"
	} else if bmi > 20 && bmi < 25 {
		return "Healthy"
	} else if bmi > 25 && bmi < 30 {
		return "Overweight"
	}

	return "Normal"
}
