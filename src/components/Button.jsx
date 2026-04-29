function Button({
  children,
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}) {
  const variants = {
    primary:
      'bg-gradient-to-r from-accent via-blue-700 to-primary text-white shadow-glow hover:scale-[1.02] hover:shadow-[0_20px_60px_rgba(59,130,246,0.45)]',
    secondary:
      'bg-white/10 text-white shadow-[0_12px_36px_rgba(15,23,42,0.3)] ring-1 ring-white/20 hover:scale-[1.02] hover:bg-white/16',
  }

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold tracking-[0.02em] transition duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
