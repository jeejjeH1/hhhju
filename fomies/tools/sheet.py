import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f).resize((960,540)) for f in fs]
cols=2; rows=(len(ims)+1)//2
s=Image.new('RGB',(960*cols,540*rows))
for i,im in enumerate(ims): s.paste(im,((i%cols)*960,(i//cols)*540))
s.save(sys.argv[1])
