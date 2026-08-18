import { Camera, ImagePlus, Save, SplitSquareHorizontal, Wand2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, EmptyState, ErrorState } from "../components/ui";
import { useApp } from "../context/AppContext";
import { canUseVirtualTryOn } from "../services/tryOnService";
import type { TryOnResult } from "../types";

export const TryOnPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { products, generateTryOn, saveTryOn, addToCart } = useApp();
  const product = products.find((item) => item.id === productId);
  const [sourceImage, setSourceImage] = useState("");
  const [size, setSize] = useState("M");
  const [color, setColor] = useState("Original");
  const [processing, setProcessing] = useState(false);
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TryOnResult | null>(null);

  if (!canUseVirtualTryOn(product)) {
    return <div className="mx-auto max-w-5xl px-4 py-10"><EmptyState title="Virtual Try-On unavailable" message="This feature is shown only for selected supported clothing products." action={<Link to="/products"><Button>Browse Products</Button></Link>} /></div>;
  }

  const onFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Failed image upload. Please select an image file.");
      return;
    }
    setSourceImage(URL.createObjectURL(file));
    setError("");
  };

  const run = async () => {
    if (!sourceImage) {
      setError("Upload an image or use the camera simulation first.");
      return;
    }
    try {
      setProcessing(true);
      setError("");
      setResult(await generateTryOn(product!, sourceImage, size, color));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed Try-On generation.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link to={`/products/${product!.id}`} className="text-sm font-semibold text-primary-700">Back to product</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-black">Virtual Try-On</h1>
          <p className="mt-2 text-sm text-slate-500">This is a frontend simulation for supported clothing. A real image processing API can be connected through the try-on service later.</p>
          <div className="mt-5 rounded-lg bg-slate-50 p-3">
            <img src={product!.images[0]} alt={product!.name} className="h-52 w-full rounded-md object-cover" />
            <p className="mt-2 font-semibold">{product!.name}</p>
          </div>
          <div className="mt-5 grid gap-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">
              <ImagePlus className="h-4 w-4" /> Upload Image
              <input type="file" accept="image/*" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
            </label>
            <Button variant="secondary" onClick={() => setSourceImage("https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80")}><Camera className="h-4 w-4" /> Use Camera</Button>
            <label className="block text-sm font-medium">Size<select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={size} onChange={(event) => setSize(event.target.value)}><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option></select></label>
            <label className="block text-sm font-medium">Color<select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={color} onChange={(event) => setColor(event.target.value)}><option>Original</option><option>Black</option><option>Blue</option><option>White</option><option>Red</option></select></label>
            <Button disabled={processing} onClick={run}><Wand2 className="h-4 w-4" /> {processing ? "Processing..." : "Generate Preview"}</Button>
          </div>
        </aside>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {error && <ErrorState message={error} />}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Preview title="Customer Image" image={sourceImage} placeholder="Upload or use camera to create a source preview." />
            <Preview title="Generated Preview" image={result?.previewImage} placeholder={processing ? "Simulating AI processing..." : "Generated result will appear here."} />
          </div>
          {result && (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => saveTryOn(result)}><Save className="h-4 w-4" /> Save Result</Button>
              <Button variant="secondary" onClick={() => setCompare(!compare)}><SplitSquareHorizontal className="h-4 w-4" /> Compare Result</Button>
              <Button variant="secondary" onClick={() => addToCart(product!)}>Add to Cart</Button>
              <Button onClick={() => { addToCart(product!); navigate("/checkout"); }}>Buy Now</Button>
            </div>
          )}
          {compare && result && <div className="mt-5 rounded-lg bg-primary-50 p-4 text-sm font-medium text-primary-800">Comparison view is active: source image and simulated clothing preview are shown side by side.</div>}
        </section>
      </div>
    </div>
  );
};

const Preview = ({ title, image, placeholder }: { title: string; image?: string; placeholder: string }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
    <h2 className="font-semibold">{title}</h2>
    {image ? <img src={image} alt={title} className="mt-3 h-96 w-full rounded-md object-cover" /> : <div className="mt-3 grid h-96 place-items-center rounded-md border border-dashed border-slate-300 p-6 text-center text-slate-500">{placeholder}</div>}
  </div>
);
