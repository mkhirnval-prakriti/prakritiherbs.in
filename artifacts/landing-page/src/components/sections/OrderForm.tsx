import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateOrder } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, ShieldCheck, Truck } from "lucide-react";

const orderSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().min(10, "Please enter a valid phone number").max(15),
  address: z.string().min(10, "Please enter your complete address").max(500),
  pincode: z.string().min(6, "Please enter a valid 6-digit pincode").max(10),
  quantity: z.coerce.number().min(1).max(5),
  product: z.string()
});

type OrderFormValues = z.infer<typeof orderSchema>;

export function OrderForm() {
  const [successData, setSuccessData] = useState<{orderId: string, message: string} | null>(null);
  const { mutate, isPending } = useCreateOrder();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      product: "KamaSutra Gold+",
      quantity: 1,
    }
  });

  const onSubmit = (data: OrderFormValues) => {
    mutate(
      { data },
      {
        onSuccess: (response) => {
          setSuccessData({
            orderId: response.orderId,
            message: response.message
          });
        },
        onError: () => {
          alert("Failed to submit order. Please try calling us instead.");
        }
      }
    );
  };

  if (successData) {
    return (
      <section id="order-form" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-card rounded-3xl p-8 md:p-12 shadow-2xl border border-primary/20 text-center"
          >
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display text-foreground">Order Confirmed!</h2>
            <p className="text-lg text-muted-foreground mb-6">
              {successData.message}
            </p>
            <div className="bg-muted rounded-xl p-4 inline-block mb-8 border border-border">
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">Your Order ID</p>
              <p className="text-2xl font-mono text-primary font-bold">{successData.orderId}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Our executive will call you shortly to verify your order details before dispatch.
            </p>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section id="order-form" className="py-24 bg-muted/30 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto bg-card rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col lg:flex-row">
          
          <div className="lg:w-2/5 bg-secondary text-secondary-foreground p-8 md:p-12 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute inset-0 bg-noise opacity-20 mix-blend-overlay"></div>
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 font-display text-white">
                Secure Your <span className="text-primary">Order</span> Today
              </h2>
              <p className="text-secondary-foreground/80 mb-8 text-lg">
                Pay only when the product reaches your doorstep. 100% secure and discreet packaging.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Free Delivery</h4>
                    <p className="text-secondary-foreground/70 text-sm">3-5 days delivery across India</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Discreet Packaging</h4>
                    <p className="text-secondary-foreground/70 text-sm">No branding on the outer box</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-12 pt-8 border-t border-secondary-foreground/20">
              <div className="flex items-center gap-4">
                <div className="font-display">
                  <p className="text-sm text-secondary-foreground/70 uppercase tracking-widest font-bold">Total Price</p>
                  <p className="text-3xl font-bold text-white">₹1,499 <span className="text-sm font-sans font-normal text-secondary-foreground/70 line-through">₹2,999</span></p>
                </div>
                <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase">
                  50% OFF
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-3/5 p-8 md:p-12">
            <h3 className="text-2xl font-bold mb-8 flex items-center gap-2">
              Cash on Delivery (COD) Form
            </h3>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-semibold text-foreground">Full Name *</label>
                  <input
                    id="name"
                    type="text"
                    {...register("name")}
                    className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors.name ? 'border-destructive' : 'border-border'}`}
                    placeholder="e.g. Rahul Sharma"
                  />
                  {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-semibold text-foreground">Phone Number *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-muted-foreground">+91</span>
                    <input
                      id="phone"
                      type="tel"
                      {...register("phone")}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors.phone ? 'border-destructive' : 'border-border'}`}
                      placeholder="98765 43210"
                    />
                  </div>
                  {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone.message}</p>}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="address" className="text-sm font-semibold text-foreground">Complete Address *</label>
                  <textarea
                    id="address"
                    rows={3}
                    {...register("address")}
                    className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors resize-none ${errors.address ? 'border-destructive' : 'border-border'}`}
                    placeholder="House/Flat No., Street, Area, City"
                  />
                  {errors.address && <p className="text-destructive text-sm mt-1">{errors.address.message}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="pincode" className="text-sm font-semibold text-foreground">Pincode *</label>
                  <input
                    id="pincode"
                    type="text"
                    {...register("pincode")}
                    className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors.pincode ? 'border-destructive' : 'border-border'}`}
                    placeholder="e.g. 110001"
                  />
                  {errors.pincode && <p className="text-destructive text-sm mt-1">{errors.pincode.message}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="quantity" className="text-sm font-semibold text-foreground">Quantity (Bottles) *</label>
                  <select
                    id="quantity"
                    {...register("quantity")}
                    className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors.quantity ? 'border-destructive' : 'border-border'}`}
                  >
                    <option value="1">1 Bottle - ₹1,499</option>
                    <option value="2">2 Bottles - ₹2,799 (Save Extra)</option>
                    <option value="3">3 Bottles - ₹3,999 (Best Value)</option>
                  </select>
                  {errors.quantity && <p className="text-destructive text-sm mt-1">{errors.quantity.message}</p>}
                </div>

                <input type="hidden" {...register("product")} />

              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full mt-6 flex items-center justify-center gap-2 py-4 px-8 bg-gradient-to-r from-primary to-yellow-600 text-primary-foreground font-bold text-lg rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing Order...
                  </>
                ) : (
                  <>Place Order Now (COD)</>
                )}
              </button>
              
              <p className="text-center text-xs text-muted-foreground mt-4">
                By placing an order, you agree to our terms and conditions. No payment required right now.
              </p>
            </form>
          </div>

        </div>
      </div>
    </section>
  );
}
