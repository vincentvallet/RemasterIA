export function shuffleItems<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

export function randomOtherIndex(length: number, current: number, random: () => number = Math.random): number {
  if (length < 2) return 0;
  const choice = Math.floor(random() * (length - 1));
  return choice >= current ? choice + 1 : choice;
}
