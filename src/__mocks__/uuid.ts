let counter = 0;

export const v4 = () => {
  counter++;
  // Return a predictable UUID based on the counter
  return `mock-uuid-${counter}`;
};
