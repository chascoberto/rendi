import { barcodeVideo } from './barcode-video'
console.log(await barcodeVideo(process.argv[2] ?? '4006381333931'))
