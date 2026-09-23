import Layout from '../components/Layout';
import ReactionForm from '../components/ReactionForm';

export default function Home() {
  return (
    <Layout>
      <section className="hero">
        <h1>React postingan Saluran WhatsApp dengan mudah.</h1>
        <p>Masukkan link postingan, pilih emoji, lalu biarkan sistem memproses reaction untukmu.</p>
      </section>
      <ReactionForm />
    </Layout>
  );
}
