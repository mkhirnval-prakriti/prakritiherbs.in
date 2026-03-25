import { motion } from "framer-motion";

export function Gallery() {
  const images = [
    {
      src: `${import.meta.env.BASE_URL}images/gallery-1.png`,
      alt: "Ayurvedic Herbs",
      className: "col-span-1 row-span-1",
    },
    {
      src: `${import.meta.env.BASE_URL}images/gallery-2.png`,
      alt: "Healthy Lifestyle",
      className: "col-span-1 row-span-2",
    },
    {
      src: `${import.meta.env.BASE_URL}images/gallery-3.png`,
      alt: "Premium Bottle Details",
      className: "col-span-1 row-span-1",
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            The Gold Standard of <span className="text-gradient">Purity</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Experience the finest selection of handpicked herbs, processed with ancient Ayurvedic wisdom to deliver unmatched potency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {images.map((img, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: idx * 0.2 }}
              className={`relative rounded-2xl overflow-hidden shadow-lg group ${img.className} aspect-square md:aspect-auto`}
            >
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 mix-blend-overlay duration-500"></div>
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
