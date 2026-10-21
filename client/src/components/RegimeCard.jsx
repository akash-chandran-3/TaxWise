// Shows one regime's result: deductions, slab-by-slab table and total tax.
import { formatINR } from '../format.js';

const DEDUCTION_LABELS = {
  standardDeduction: 'Standard deduction',
  hra: 'HRA exemption',
  section80C: 'Section 80C',
  section80D: 'Section 80D',
};

function slabLabel(slab) {
  if (slab.to == null) return `Above ${formatINR(slab.from)}`;
  return `${formatINR(slab.from)} – ${formatINR(slab.to)}`;
}

// One "label ........ amount" line.
function Line({ label, amount, className = '' }) {
  return (
    <div className={`line ${className}`}>
      <dt>{label}</dt>
      <dd>{formatINR(amount)}</dd>
    </div>
  );
}

export default function RegimeCard({ title, result, isRecommended }) {
  const deductions = Object.entries(result.deductions).filter(([, amount]) => amount > 0);

  return (
    <section className={`card regime-card ${isRecommended ? 'recommended' : ''}`}>
      <h2>
        {title}
        {isRecommended && <span className="badge">Lower tax</span>}
      </h2>

      <dl>
        <Line label="Gross income" amount={result.grossIncome} />
        {deductions.map(([key, amount]) => (
          <Line key={key} label={`− ${DEDUCTION_LABELS[key]}`} amount={amount} />
        ))}
        <Line label="Taxable income" amount={result.taxableIncome} className="strong" />
      </dl>

      <table>
        <thead>
          <tr>
            <th>Slab</th>
            <th>Rate</th>
            <th>Income in slab</th>
            <th>Tax</th>
          </tr>
        </thead>
        <tbody>
          {result.slabBreakdown.map((slab) => (
            <tr key={slab.from} className={slab.amountInSlab === 0 ? 'faded' : ''}>
              <td>{slabLabel(slab)}</td>
              <td>{slab.rate}%</td>
              <td>{formatINR(slab.amountInSlab)}</td>
              <td>{formatINR(slab.tax)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl>
        <Line label="Tax on slabs" amount={result.slabTax} />
        {result.rebate > 0 && <Line label="− Rebate u/s 87A" amount={result.rebate} />}
        {result.marginalRelief > 0 && <Line label="− Marginal relief" amount={result.marginalRelief} />}
        <Line label="+ Health & education cess" amount={result.cess} />
        <Line label="Total tax" amount={result.totalTax} className="total" />
      </dl>
    </section>
  );
}
