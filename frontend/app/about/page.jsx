import StoreShell from '../../components/StoreShell';
import Link from 'next/link';
import { Award, FlaskConical, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'About Sclero Proteins | Science-Backed Active Nutrition',
  description: 'Learn about Sclero Proteins, our transparent formulations, GMP standards, and UK and India fulfilment hubs.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Sclero Proteins',
    description: 'Science-backed, label-transparent active nutrition for mobility, protein, and everyday wellness.',
  },
};

export default function AboutPage() {
  return (
    <StoreShell>
      <main>
        <section className="border-b border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-black uppercase tracking-widest text-brand-purple">About Sclero Proteins</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-brand-navy sm:text-5xl">
              Transparent active nutrition, built around clinical evidence.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-brand-muted">
              Sclero Proteins Ltd develops clinically informed bone, joint, protein, and wellness formulations with clear ingredient quantities, regional fulfilment, and quality-led manufacturing.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            { icon: FlaskConical, title: 'Science-led formulas', copy: 'No proprietary blends. Each formulation is structured around active ingredients customers can understand.' },
            { icon: ShieldCheck, title: 'GMP standards', copy: 'Manufacturing and fulfilment are designed around repeatability, quality control, and product traceability.' },
            { icon: Award, title: 'Regional integrity', copy: 'UK and India operations support local pricing, domestic shipping, and region-specific compliance.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <Icon className="h-7 w-7 text-brand-purple" />
                <h2 className="mt-4 text-base font-black text-brand-navy">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-brand-muted">{item.copy}</p>
              </article>
            );
          })}
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-brand-navy">Our focus</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-brand-muted">
              Our signature BJC range combines bioactive peptides, minerals, and vitamins researched for cartilage integrity, bone density, and everyday joint flexibility. The same transparency principles guide our protein and performance nutrition range.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary px-6 py-3 text-sm">Shop products</Link>
              <Link href="/contact" className="btn-ghost px-6 py-3 text-sm">Contact support</Link>
            </div>
          </div>
        </section>
      </main>
    </StoreShell>
  );
}
