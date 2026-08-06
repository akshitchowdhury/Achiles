import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ACTIVITY_LEVELS, tdee } from "../../lib/fitness";
import { num } from "../../lib/format";
import { useChartTheme } from "./useChartTheme";

interface CalorieByActivityChartProps {
  bmr: number;
}

/**
 * Magnitude, low → high: one hue, stepped. The ramp is ordinal here because
 * activity level is itself ordered, so colour never contradicts the bar length.
 * Single series, so the card title does the work a legend would.
 */
export function CalorieByActivityChart({ bmr }: CalorieByActivityChartProps) {
  const chart = useChartTheme();
  const data = ACTIVITY_LEVELS.map((level) => ({
    label: level.label,
    detail: level.detail,
    calories: tdee(bmr, level.factor),
  }));

  return (
    // min-w-0 lets the container actually shrink; ResponsiveContainer measures
    // this box, so without it the chart would size to its content and force the
    // page to scroll sideways on narrow screens.
    <div className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={228}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
          barCategoryGap="22%"
        >
          {/* Values are direct-labelled at each tip, so the value axis is redundant. */}
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            width={78}
            tick={{ fill: chart.axisTick.fill, fontSize: chart.axisTick.fontSize }}
          />
          <Tooltip
            cursor={{ fill: chart.cursorFill }}
            contentStyle={chart.tooltipStyle}
            labelStyle={{ color: chart.ink, fontWeight: 600, marginBottom: 2 }}
            itemStyle={{ color: chart.inkDim }}
            formatter={(value) => [
              `${num.format(Number(value))} kcal/day`,
              "Maintenance",
            ]}
            labelFormatter={(label) => {
              const row = data.find((d) => d.label === String(label));
              return row ? `${row.label} — ${row.detail}` : String(label);
            }}
          />
          <Bar
            dataKey="calories"
            barSize={22}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            {data.map((row, index) => (
              <Cell key={row.label} fill={chart.ramp[index]} />
            ))}
            <LabelList
              dataKey="calories"
              position="right"
              offset={8}
              formatter={(value) => num.format(Number(value))}
              style={{ fill: chart.inkDim, fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
