// Doughnut chart of one month's spending by category, with a table of the
// same numbers next to it (so nobody has to read amounts from colours alone).
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { formatINR } from '../format.js';

// Chart.js is modular: register only the pieces this chart uses.
ChartJS.register(ArcElement, Tooltip, Legend);

// Each category always gets the same colour, whatever its rank this month.
// (8 hues checked for colour-blind separation.)
const CATEGORY_COLORS = {
  Food: '#2a78d6',
  Rent: '#eb6834',
  Transport: '#1baf7a',
  Utilities: '#eda100',
  Shopping: '#e87ba4',
  Health: '#008300',
  Entertainment: '#6250d6',
  Other: '#e34948',
};

export default function CategoryChart({ summary }) {
  if (summary.byCategory.length === 0) {
    return <p className="muted empty">No expenses this month yet.</p>;
  }

  const percent = (amount) => Math.round((amount / summary.total) * 100);

  const data = {
    labels: summary.byCategory.map((row) => row.category),
    datasets: [
      {
        data: summary.byCategory.map((row) => row.total),
        backgroundColor: summary.byCategory.map((row) => CATEGORY_COLORS[row.category]),
        borderColor: '#ffffff', // thin white gap between slices
        borderWidth: 2,
      },
    ],
  };

  const options = {
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, color: '#1f2933' } },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${formatINR(ctx.parsed)} (${percent(ctx.parsed)}%)`,
        },
      },
    },
  };

  return (
    <div className="chart-layout">
      <div className="chart-box">
        <Doughnut
          data={data}
          options={options}
          aria-label={`Spending by category, total ${formatINR(summary.total)}`}
          role="img"
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Items</th>
            <th>Amount</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {summary.byCategory.map((row) => (
            <tr key={row.category}>
              <td>
                <span className="swatch" style={{ background: CATEGORY_COLORS[row.category] }} />
                {row.category}
              </td>
              <td>{row.count}</td>
              <td>{formatINR(row.total)}</td>
              <td>{percent(row.total)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td />
            <td>{formatINR(summary.total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
