import { ChartController, toBars, type SeriesType } from "@candlekit/charts";
import { generateBars } from "@candlekit/charts";

const chart = new ChartController(document.getElementById("chart")!, {
  theme: "dark",
  seriesType: "candlestick",
  showVolume: true,
});

chart.setData(toBars(generateBars(600)));

document.querySelectorAll<HTMLButtonElement>("button[data-type]").forEach((btn) => {
  btn.addEventListener("click", () => chart.setSeriesType(btn.dataset.type as SeriesType));
});

let dark = true;
document.getElementById("theme")!.addEventListener("click", () => {
  dark = !dark;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.body.style.background = dark ? "#0e1117" : "#ffffff";
  document.body.style.color = dark ? "#e5e7eb" : "#1f2937";
  chart.setTheme(dark ? "dark" : "light");
});
