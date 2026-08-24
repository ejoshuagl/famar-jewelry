"use client";

import { motion } from "framer-motion";
import {
  Box,
  Droplets,
  ShieldCheck,
  Sparkles,
  SprayCan,
  Sun,
} from "lucide-react";

const careTips = [
  {
    icon: SprayCan,
    title: "Perfume primero, joyas después",
    description:
      "Espera a que perfumes, cremas y maquillaje se sequen antes de colocarte tus accesorios.",
  },
  {
    icon: Droplets,
    title: "Evita el contacto con agua",
    description:
      "Retira tus piezas antes de bañarte, nadar o hacer ejercicio, especialmente si tienen baño de oro.",
  },
  {
    icon: Sparkles,
    title: "Límpialas con suavidad",
    description:
      "Después de usarlas, pásales un paño seco y suave. No uses alcohol ni productos abrasivos.",
  },
  {
    icon: Box,
    title: "Guárdalas por separado",
    description:
      "Conserva cada pieza en una bolsita o compartimento para evitar rayones y enredos.",
  },
  {
    icon: Sun,
    title: "Protégelas del ambiente",
    description:
      "Mantenlas lejos del sol directo, la humedad y los cambios bruscos de temperatura.",
  },
];

export function JewelryCareView() {
  return (
    <section
      aria-labelledby="care-guide-title"
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-b from-primary/[0.08] via-background to-background py-16 sm:py-20"
    >
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl"
      />

      <div className="container relative mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <ShieldCheck className="h-4 w-4" />
            Haz que brillen por más tiempo
          </div>
          <h2
            id="care-guide-title"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Guía de Cuidados de la Joyería
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
            Pequeños hábitos ayudan a conservar el color, el brillo y el acabado
            de tu bisutería favorita.
          </p>
        </motion.div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {careTips.map((tip, index) => {
            const Icon = tip.icon;

            return (
              <motion.article
                key={tip.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className="group rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-semibold leading-5">{tip.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {tip.description}
                </p>
              </motion.article>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm leading-6 sm:items-center sm:px-5"
        >
          <Droplets
            className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:mt-0"
            aria-hidden="true"
          />
          <p>
            <strong className="text-foreground">Importante:</strong>{" "}
            <span className="text-muted-foreground">
              las piezas con baño de oro son delicadas. Evita mojarlas y el
              contacto directo con químicos para prolongar su acabado.
            </span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
