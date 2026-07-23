module.exports = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if the dates are valid
  if (isNaN(start) || isNaN(end)) {
    throw new Error("Invalid date format. Please use 'YYYY-MM-DD'.");
  }
  // Calculate the difference in milliseconds
  const differenceInMilliseconds = end - start;
  // Convert the difference to days, rounding up to ensure full days are counted
  const differenceInDays = Math.ceil(
    differenceInMilliseconds / (1000 * 60 * 60 * 24)
  );

  // إضافة يوم واحد لحساب اليوم الأول والأخير
  return differenceInDays + 1;
};
