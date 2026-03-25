import { motion } from "framer-motion";
import { Star } from "lucide-react";

export function Reviews() {
  const reviews = [
    {
      name: "Rajesh K.",
      location: "Delhi",
      rating: 5,
      text: "I was skeptical at first, but KamaSutra Gold+ has completely changed my daily energy levels. I don't feel tired after a long day of work anymore. Highly recommended!",
      initials: "RK"
    },
    {
      name: "Suresh T.",
      location: "Bangalore",
      rating: 5,
      text: "Premium quality product. The packaging is excellent and the results are visible within 3 weeks. Authentic Ayurvedic formulation.",
      initials: "ST"
    },
    {
      name: "Amit S.",
      location: "Pune",
      rating: 4,
      text: "Good product. Helps with stamina and overall stress relief. I take it with warm milk as suggested. Will order again.",
      initials: "AS"
    },
    {
      name: "Priya M.",
      location: "Mumbai",
      rating: 5,
      text: "Bought this for my husband and we are both very happy with the results. It's completely natural so there's peace of mind.",
      initials: "PM"
    },
    {
      name: "Neha R.",
      location: "Hyderabad",
      rating: 5,
      text: "Prakriti Herbs always delivers quality. The blend of Ashwagandha and Shilajit in this is perfectly balanced. 10/10.",
      initials: "NR"
    }
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-primary font-bold tracking-wider uppercase text-sm">Testimonials</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mt-4 mb-6">
            Trusted by <span className="text-gradient">Thousands</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {reviews.map((review, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`bg-card p-8 rounded-2xl shadow-sm border border-border hover:shadow-lg transition-shadow ${idx === 4 ? 'md:col-span-2 lg:col-span-1 lg:col-start-2' : ''}`}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg font-display">
                  {review.initials}
                </div>
                <div>
                  <h4 className="font-bold text-foreground">{review.name}</h4>
                  <p className="text-sm text-muted-foreground">{review.location}</p>
                </div>
              </div>
              <div className="flex gap-1 mb-4 text-primary">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'opacity-30'}`} />
                ))}
              </div>
              <p className="text-muted-foreground italic">"{review.text}"</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
