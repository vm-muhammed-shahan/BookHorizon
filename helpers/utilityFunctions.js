function validateAddress({ name, phone, altPhone, city, state, landMark, pincode }) {
  const nameRegex = /^[A-Za-z ]{2,50}$/;
  const cityRegex = /^[A-Za-z ]{2,50}$/;
  const stateRegex = /^[A-Za-z ]{2,50}$/;
  const landMarkRegex = /^[A-Za-z0-9 ]{2,50}$/;
  const phoneRegex = /^[6-9]\d{9}$/;
  const pincodeRegex = /^[1-9][0-9]{5}$/;

  const isInvalidPhone = (num) =>
    /^(\d)\1{9}$/.test(num) || num === "1234567890";

  if (!nameRegex.test(name)) {
    return { valid: false, error: "Name must be 2–50 alphabets only" };
  }
  if (!cityRegex.test(city)) {
    return { valid: false, error: "City must be 2–50 alphabets only" };
  }
  if (!stateRegex.test(state)) {
    return { valid: false, error: "State must be 2–50 alphabets only" };
  }
  if (!landMarkRegex.test(landMark)) {
    return { valid: false, error: "Landmark must be 2–50 characters (letters/numbers only)" };
  }
  if (!phoneRegex.test(phone) || isInvalidPhone(phone)) {
    return { valid: false, error: "Invalid phone number" };
  }
  if (altPhone && (!phoneRegex.test(altPhone) || isInvalidPhone(altPhone))) {
    return { valid: false, error: "Invalid alternate phone number" };
  }
  if (phone === altPhone) {
    return { valid: false, error: "Phone and Alternate Phone must be different" };
  }
  if (!pincodeRegex.test(pincode)) {
    return { valid: false, error: "Pincode must be 6 digits, not starting with 0" };
  }

  return { valid: true };
}

module.exports = validateAddress;
