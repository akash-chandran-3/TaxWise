export default function Disclaimer() {
  return (
    <aside className="disclaimer" role="note">
      <strong>This is an estimate, not tax advice.</strong> TaxWise covers resident individuals
      below 60 with salary and other normal income. It leaves out surcharge (income above ₹50 lakh),
      special-rate income such as capital gains, and many other deductions. Tax rules change every
      year. Check your figures on{' '}
      <a href="https://www.incometax.gov.in" target="_blank" rel="noreferrer">incometax.gov.in</a>{' '}
      or with a tax professional before you file.
    </aside>
  );
}
