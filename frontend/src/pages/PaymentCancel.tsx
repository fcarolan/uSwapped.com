import { Link } from "react-router-dom";

export default function PaymentCancel() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="brutal rounded-3xl bg-white p-10 text-center" data-testid="payment-cancel-card">
        <h1 className="text-3xl font-extrabold">Checkout cancelled</h1>
        <p className="mt-2 text-slate-600">No worries — you haven't been charged.</p>
        <Link to="/dashboard?tab=outgoing" data-testid="payment-cancel-back" className="brutal brutal-hover mt-8 inline-block rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
          Back to my swaps
        </Link>
      </div>
    </div>
  );
}
