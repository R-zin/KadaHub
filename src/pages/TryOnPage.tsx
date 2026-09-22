import { Camera, ImagePlus, Save, SplitSquareHorizontal, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CameraCapture } from "../components/CameraCapture";
import { Button, EmptyState, ErrorState } from "../components/ui";
import { useApp } from "../context/AppContext";
import { productService } from "../services/productService";
import { canUseVirtualTryOn, tryOnService } from "../services/tryOnService";
import type { Product, TryOnResult } from "../types";

export const TryOnPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { products, productsLoading, generateTryOn, saveTryOn, addToCart } = useApp();

  const cachedProduct = products.find((item) => item.id === productId);
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [fetchingProduct, setFetchingProduct] = useState(false);

  // Client-side renderable preview (blob: URL) for display in <img>
  const [customerDisplayImage, setCustomerDisplayImage] = useState("");
  // Server upload reference (path or URL) for Try-On generation API
  const [uploadedSource, setUploadedSource] = useState("");

  const [size, setSize] = useState("M");
  const [color, setColor] = useState("Original");
  const [processing, setProcessing] = useState(false);
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Ref tracking for clean unmount handling
  const displayImageRef = useRef(customerDisplayImage);
  displayImageRef.current = customerDisplayImage;
  const uploadedSourceRef = useRef(uploadedSource);
  uploadedSourceRef.current = uploadedSource;
  const resultRef = useRef(result);
  resultRef.current = result;

  useEffect(() => {
    if (!cachedProduct && productId && !productsLoading) {
      setFetchingProduct(true);
      productService
        .getProductById(productId)
        .then((prod) => setFetchedProduct(prod))
        .catch(() => setFetchedProduct(null))
        .finally(() => setFetchingProduct(false));
    }
  }, [cachedProduct, productId, productsLoading]);

  const product = cachedProduct || fetchedProduct;

  useEffect(() => {
    return () => {
      // Clean up client-side object URL to prevent memory leaks
      if (displayImageRef.current && displayImageRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(displayImageRef.current);
      }
      // Clean up temporary image on server if user navigates away before generating/saving
      if (uploadedSourceRef.current && !resultRef.current) {
        tryOnService.cleanupTempImage(uploadedSourceRef.current);
      }
    };
  }, []);

  if (productsLoading || fetchingProduct) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 animate-pulse">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="h-96 rounded-lg bg-slate-200" />
          <div className="h-96 rounded-lg bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!canUseVirtualTryOn(product)) {
    return <div className="mx-auto max-w-5xl px-4 py-10"><EmptyState title="Virtual Try-On unavailable" message="This feature is shown only for selected supported clothing products." action={<Link to="/products"><Button>Browse Products</Button></Link>} /></div>;
  }

  const onFile = async (file?: File) => {
    if (!file) return;
    setIsCameraOpen(false);
    if (!file.type.startsWith("image/")) {
      setError("Failed image upload. Please select an image file.");
      return;
    }

    // Revoke previous client-side object URL when replacing
    if (customerDisplayImage && customerDisplayImage.startsWith("blob:")) {
      URL.revokeObjectURL(customerDisplayImage);
    }

    // Clean up previously uploaded temp image to avoid abandoned copies
    if (uploadedSource) {
      tryOnService.cleanupTempImage(uploadedSource);
    }

    // Instant local preview via Blob URL (bypasses auth/network hurdles)
    const localPreviewUrl = URL.createObjectURL(file);
    setCustomerDisplayImage(localPreviewUrl);

    try {
      setError("");
      setProcessing(true);
      const serverUrl = await tryOnService.uploadImage(file);
      setUploadedSource(serverUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed image upload. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCameraCapture = async (file: File, previewUrl: string) => {
    setIsCameraOpen(false);
    setError("");

    // Revoke previous client-side object URL when replacing
    if (customerDisplayImage && customerDisplayImage.startsWith("blob:") && customerDisplayImage !== previewUrl) {
      URL.revokeObjectURL(customerDisplayImage);
    }

    // Clean up previously uploaded temp image to avoid duplicate copies
    if (uploadedSource) {
      tryOnService.cleanupTempImage(uploadedSource);
    }

    // Retain camera-generated preview URL for display
    setCustomerDisplayImage(previewUrl);

    try {
      setProcessing(true);
      const serverUrl = await tryOnService.uploadImage(file);
      setUploadedSource(serverUrl);
    } catch (err) {
      // In offline/mock mode or if upload fails, preview remains available
      console.warn("Storage upload note:", err);
    } finally {
      setProcessing(false);
    }
  };

  const run = async () => {
    if (!uploadedSource) {
      setError("Upload an image or capture a photo with your camera first.");
      return;
    }
    try {
      setProcessing(true);
      setError("");
      setResult(await generateTryOn(product!, uploadedSource, size, color));
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
          <p className="mt-2 text-sm text-slate-500">Capture a photo with your camera or upload an image to simulate clothing fit.</p>
          <div className="mt-5 rounded-lg bg-slate-50 p-3">
            <img src={product!.images[0]} alt={product!.name} className="h-52 w-full rounded-md object-cover" />
            <p className="mt-2 font-semibold">{product!.name}</p>
          </div>
          <div className="mt-5 grid gap-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">
              <ImagePlus className="h-4 w-4" /> Upload Image
              <input type="file" accept="image/*" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                setIsCameraOpen(true);
              }}
            >
              <Camera className="h-4 w-4" /> Use Camera
            </Button>
            <label className="block text-sm font-medium">Size<select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={size} onChange={(event) => setSize(event.target.value)}><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option></select></label>
            <label className="block text-sm font-medium">Color<select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={color} onChange={(event) => setColor(event.target.value)}><option>Original</option><option>Black</option><option>Blue</option><option>White</option><option>Red</option></select></label>
            <Button disabled={processing} onClick={run}><Wand2 className="h-4 w-4" /> {processing ? "Processing..." : "Generate Preview"}</Button>
          </div>
        </aside>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {error && <ErrorState message={error} />}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Preview title="Customer Image" image={customerDisplayImage} placeholder="Upload or capture with camera to create a source preview." />
            <Preview title="Generated Preview" image={result?.previewImage} placeholder={processing ? "Simulating clothing fit..." : "Generated result will appear here."} />
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

      {isCameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
};

const Preview = ({ title, image, placeholder }: { title: string; image?: string; placeholder: string }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
    <h2 className="font-semibold">{title}</h2>
    {image ? <img src={image} alt={title} className="mt-3 h-96 w-full rounded-md object-cover" /> : <div className="mt-3 grid h-96 place-items-center rounded-md border border-dashed border-slate-300 p-6 text-center text-slate-500">{placeholder}</div>}
  </div>
);
