import { expect, test } from "vitest";
import { coverCrop } from "../../src/engine/render/background";

test("cover crop keeps the aspect: a 9:16 image in a 16:9 frame uses a centred band, a same-shape image uses all of it", () => {
  expect(coverCrop(1080, 1920, 1080, 1920)).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1920 });
  const c = coverCrop(1080, 1920, 1920, 1080);
  expect(c.sw).toBe(1080);
  expect(c.sh).toBeCloseTo(607.5, 1);
  expect(c.sy).toBeCloseTo((1920 - 607.5) / 2, 1);
  expect(c.sw / c.sh).toBeCloseTo(1920 / 1080, 5);
});
