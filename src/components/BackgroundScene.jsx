import { AnimatePresence, motion } from 'framer-motion'

const PHOTOS = {
  graph:   'https://images.unsplash.com/photo-1502602898657-3e91760cbb34',
  log:     'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf',
  upload:  'https://images.unsplash.com/photo-1551958219-acbc595f8c95',
  compare: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad',
  fitness: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5',
  stats:   'https://images.unsplash.com/photo-1560969184-10fe8719e047',
}

export default function BackgroundScene({ page }) {
  const url = PHOTOS[page]
  if (!url) return null
  return (
    <AnimatePresence mode="wait">
      <motion.div key={page} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        transition={{duration:0.8}}
        style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',overflow:'hidden'}}>
        <img src={`${url}?w=1920&auto=format&fit=crop&q=60`} alt=""
          style={{position:'absolute',inset:0,width:'100%',height:'100%',
                  objectFit:'cover',filter:'blur(64px) saturate(0.8) brightness(0.35)',
                  transform:'scale(1.15)',opacity:0.6}}/>
        <div style={{position:'absolute',inset:0,background:'rgba(10,15,26,0.65)'}}/>
      </motion.div>
    </AnimatePresence>
  )
}
