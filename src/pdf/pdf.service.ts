import { Injectable } from '@nestjs/common';
import PDFKit from 'pdfkit-table';
import { TPDFItenerary, TPDFMeta } from './pdf.dto';
import { format } from 'date-fns/format';
import * as QRCode from 'qrcode';
import config from 'src/config/config';
import { compile } from 'html-to-text';

interface ConfigureTextContentProps {
  text: any;
  font?: string;
  size?: number;
  position?: { x?: number; y?: number };
  options?: PDFKit.Mixins.TextOptions;
}

@Injectable()
export class PdfService {
  private cnfg = config();

  async generateItenerary(
    content: TPDFItenerary,
    filename: string,
    bucketname?: string,
  ): Promise<TPDFMeta> {
    const bookingUri = `${this.cnfg.site.domain}/booking-confirmation?reference_id=${content.referenceNumber}&email=${content.email}`;
    const qrCode = await QRCode.toDataURL(bookingUri);
    const doc = this.templatePDFItenerary({ ...content, qrCode });
    const buffer = await this.streamToBuffer(doc);

    return {
      bucketname: bucketname || process.env.AWS_S3_BUCKET,
      filename: filename,
      buffer: buffer,
      mimetype: 'application/pdf',
    };
  }

  async generateTourDetails(
    content: Array<{ title: string; content: string }>,
    filename: string,
    bucketname?: string,
  ): Promise<TPDFMeta> {
    const doc = this.templatePDFTourDetails(content);
    const buffer = await this.streamToBuffer(doc);

    return {
      bucketname: bucketname || process.env.AWS_S3_BUCKET,
      filename: filename,
      buffer: buffer,
      mimetype: 'application/pdf',
    };
  }

  private templatePDFTourDetails(
    content: Array<{ title: string; content: string }>,
  ): PDFKit.PDFDocument {
    const paper = {
      size: 'letter',
      margin: 30,
    };
    const options = {
      wordwrap: 130,
    };
    const compiledConvert = compile(options);
    const doc = new PDFKit();

    const assets = {
      logo: 'src/assets/images/logo.png',
    };

    const FONT_POPPINS = 'src/assets/fonts/Poppins-Regular.ttf';
    const FONT_JOSEFINSANS_BOLD = 'src/assets/fonts/JosefinSans-Bold.ttf';
    // const FONT_POPPINS_BOLD = 'src/assets/fonts/Poppins-Bold.ttf';
    const JUSTIFY_END = doc.page.width - paper.margin;
    const ALIGN_END = doc.page.height - paper.margin;
    // const FONT_SIZE = { small: 7, default: 10, medium: 20, large: 40 };
    const pageWriter = (
      d: { title: string; content: string },
      newPaper = true,
    ) => {
      if (newPaper) doc.addPage(paper);
      doc
        .font(FONT_JOSEFINSANS_BOLD)
        .fontSize(20)
        .text(d.title, paper.margin, paper.margin, { align: 'center' });
      const htmlText = [d.content].map(compiledConvert)[0];
      doc
        .font(FONT_POPPINS)
        .fontSize(10)
        .text(htmlText, paper.margin, paper.margin + 50);
      doc.image(
        assets.logo,
        JUSTIFY_END - paper.margin - 50,
        ALIGN_END - paper.margin - 50,
        {
          width: 100,
        },
      );
    };
    const firstPage = content.splice(0, 1);
    pageWriter(firstPage[0], false);
    content.forEach((text) => pageWriter(text));
    doc.end();
    return doc;
  }

  private templatePDFItenerary(
    content: TPDFItenerary & { qrCode: string },
  ): PDFKit.PDFDocument {
    const {
      referenceNumber,
      lastName,
      firstName,
      suffix,
      middleInitial,
      guests,
      email,
      mobileNumber1,
      nationality,
      mobileNumber2,
      booking_date,
      booked_tours,
      grandTotal,
      fees,
      qrCode,
    } = content;

    const allGuests = Object.values(guests).flat();
    const uniqueGuests = Array.from(new Set(allGuests.map(({ id }) => id)));
    const masterList = uniqueGuests.map((id) =>
      allGuests.find((guest) => guest.id === id),
    );

    const joinStrings = (...arr) => {
      return arr.filter(Boolean).join(' ');
    };

    const leadGuest = joinStrings(firstName, middleInitial, lastName, suffix);
    const adults = masterList.filter((guest) => guest.age >= 7).length;
    const kids = masterList.filter((guest) => guest.age < 7).length;

    const paper = {
      size: 'letter',
      margin: 30,
    };
    const doc = new PDFKit(paper);

    const assets = {
      bgImage: 'src/assets/images/pageBg.png',
      logo: 'src/assets/images/logo.png',
      signature: 'src/assets/images/signature.png',
    };

    doc.image(assets.bgImage, 0, 0, {
      width: doc.page.width,
      height: doc.page.height,
    });

    const fontSize = { small: 2, default: 3, medium: 4, large: 10 };

    const FONT_POPPINS = 'src/assets/fonts/Poppins-Regular.ttf';
    const FONT_JOSEFINSANS_BOLD = 'src/assets/fonts/JosefinSans-Bold.ttf';
    const FONT_POPPINS_BOLD = 'src/assets/fonts/Poppins-Bold.ttf';
    const JUSTIFY_END = doc.page.width - paper.margin;
    const ALIGN_END = doc.page.height - paper.margin;
    const FONT_SIZE = { small: 7, default: 10, medium: 20, large: 40 };

    const configureTextContent = ({
      text,
      font = FONT_POPPINS,
      size = fontSize.default,
      position,
      options = {} as PDFKit.Mixins.TextOptions,
    }: ConfigureTextContentProps) => {
      return doc
        .font(font || FONT_POPPINS)
        .fontSize(size || FONT_SIZE.default)
        .text(text.toString(), position?.x, position?.y, {
          width: options?.width,
          align: options?.align || 'left',
          lineGap: options?.lineGap || 0,
          ...options,
        });
    };

    const div_1 = (x, y) => {
      configureTextContent({
        font: FONT_JOSEFINSANS_BOLD,
        size: FONT_SIZE.large,
        position: {
          x: x + 360 + paper.margin,
          y: y + paper.margin,
        },
        text: 'Voucher',
        options: { width: 200, align: 'center' },
      });

      doc.image(qrCode, x + 410 + paper.margin, y + paper.margin + 36, {
        width: 100,
        height: 100,
      });

      doc.image(assets.logo, 0, y + paper.margin - 10, {
        width: 125,
      });
    };
    const div_2 = (x, y) => {
      configureTextContent({
        size: FONT_SIZE.default,
        text: 'RIZAL ST BRGY MALIGAYA EL NIDO, PALAWAN PHILIPPINES 5313',
        font: FONT_POPPINS,
        position: { x: x + 280, y: y },
        options: { width: 200, align: 'left', lineGap: -2 },
      });

      configureTextContent({
        size: FONT_SIZE.default,
        text: 'Email: ztoursph@gmail.com',
        font: FONT_POPPINS,
        position: {
          x: x + 280,
          y: y + 25,
        },
        options: { width: 200, align: 'left' },
      });

      configureTextContent({
        size: FONT_SIZE.default,
        text: 'Whatsapp: +63966-442-8625',
        font: FONT_POPPINS,
        position: {
          x: x + 280,
          y: y + 36,
        },
        options: { width: 200, align: 'left' },
      });

      configureTextContent({
        size: FONT_SIZE.default,
        text: 'Office number: +63962-078-7353',
        font: FONT_POPPINS,
        position: { x: x + 280, y: y + 47 },
        options: { width: 200, align: 'left' },
      });
    };

    const div_3 = (x, y) => {
      configureTextContent({
        text: 'Guest Information',
        font: 'Helvetica-Bold',
        size: FONT_SIZE.medium - 3,
        position: { x: x, y: y + paper.margin },
        options: { width: doc.page.width, align: 'center' },
      });
    };

    const div_8 = (x, y) => {
      configureTextContent({
        text: 'Package and Tours',
        font: 'Helvetica-Bold',
        size: FONT_SIZE.medium - 3,
        position: { x: x, y: y + paper.margin },
        options: { width: doc.page.width, align: 'center' },
      });
    };

    const div_4 = (x, y) => {
      // Lead Guest Value
      configureTextContent({
        text: leadGuest,
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin + 100, y: y },
        options: { width: 200 },
      });

      // Quantity Value
      configureTextContent({
        text: masterList.length,
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin + 55, y: y + 13 },
        options: { width: 80, align: 'left' },
      });

      // Adult Value
      configureTextContent({
        text: adults.toString(),
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin + 40, y: y + 13 * 2 },
        options: { width: 80 },
      });

      // Minor/Kid Value
      configureTextContent({
        text: kids.toString(),
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin + 40, y: y + 13 * 3 },
        options: { width: 80 },
      });

      // Nationality Value
      configureTextContent({
        text: nationality,
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin + 65, y: y + 13 * 4 },
        options: { width: 200 },
      });

      // Booking Date Value
      configureTextContent({
        text: format(new Date(booking_date), 'MMM dd, yyyy'),
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: JUSTIFY_END + x - 150 + 55, y: y },
        options: { width: 80 },
      });

      // Email Value
      configureTextContent({
        text: email || 'N/A',
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin + 35, y: y + 13 * 5 },
        options: { width: 150 },
      });

      // Contact Number Value
      configureTextContent({
        text: mobileNumber1,
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin + 100, y: y + 13 * 6 },
        options: { width: 100 },
      });
      // Contact Number Value
      configureTextContent({
        text: mobileNumber2,
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin + 100, y: y + 13 * 7 },
        options: { width: 100 },
      });

      //Boilerplates
      configureTextContent({
        text: 'Lead Guest Name:',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: y },
        options: { width: 100 },
      });

      configureTextContent({
        text: 'Quantity:',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: y + 13 },
        options: { width: 80 },
      });

      configureTextContent({
        text: 'Adult:',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: y + 13 * 2 },
        options: { width: 80 },
      });

      configureTextContent({
        text: 'Kids: ',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: y + 13 * 3 },
        options: { width: 80 },
      });

      configureTextContent({
        text: 'Nationality: ',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: y + 13 * 4 },
        options: { width: 80 },
      });

      configureTextContent({
        text: 'Email: ',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: y + 13 * 5 },
        options: { width: 80 },
      });

      configureTextContent({
        text: 'Mobile Number 1: ',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: y + 13 * 6 },
        options: { width: 100 },
      });

      configureTextContent({
        text: 'Mobile Number 2: ',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: y + 13 * 7 },
        options: { width: 100 },
      });

      configureTextContent({
        text: 'Booking Date: ',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: JUSTIFY_END + x - 175, y: y },
        options: { width: 80 },
      });

      configureTextContent({
        size: FONT_SIZE.default,
        font: FONT_POPPINS_BOLD,
        position: { x: JUSTIFY_END + x - 175, y: y + 13 },
        text: `Booking Reference Number: ${referenceNumber}`,
      });
    };

    const div_5 = async (x, y) => {
      const table = {
        addPage: true,
        headers: [
          {
            label: 'Tour Date',
            property: 'date',
            width: 80,
            renderer: (value) => {
              if (value) return format(value, 'MMM dd, yyyy');
              return '';
            },
          },
          { label: 'Tour Name', property: 'title', width: 190 },
          { label: 'Time', property: 'pickup_time', width: 90 },
          { label: 'Pax', property: 'pax', width: 90 },
          {
            label: 'Sub-Total',
            property: 'subtotal',
            width: 90,
            renderer: (value) =>
              `P ${new Intl.NumberFormat('en-PH', {
                currency: 'PHP',
              }).format(Number(value))}`,
          },
        ],

        datas: [
          ...booked_tours.map((tour) => ({
            date: tour.date,
            title: tour.title,
            time: tour.pickup_time,
            pax: tour.pax.toString(),
            subtotal: tour.subtotal,
          })),
          {
            date: '',
            title: '',
            time: '',
            pax: 'Convenience Fee',
            subtotal: fees.toString(),
          },
          {
            date: '',
            title: '',
            time: '',
            pax: 'Grand Total',
            subtotal: grandTotal.toString(),
          },
        ],
      };
      // the magic (async/await)
      await doc.table(table, {
        x: x + paper.margin,
        y: y,
        prepareHeader: () => doc.font(FONT_POPPINS).fontSize(FONT_SIZE.default),
        prepareRow() {
          return doc.font(FONT_POPPINS).fontSize(FONT_SIZE.default);
        },
        padding: [5, 5, 5, 5],
      });
    };

    const div_6 = (x, y) => {
      doc.page.margins.bottom = 0;

      configureTextContent({
        text: 'Term and Conditions:',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: ALIGN_END + y },
        options: { width: 150, align: 'left' },
      });

      configureTextContent({
        text: 'Confirmation is due 5 days from the invoice date',
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: { x: x + paper.margin, y: ALIGN_END + y + 13 },
        options: { width: 180, align: 'left' },
      });

      configureTextContent({
        text: 'Prepared by :',
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: {
          x: JUSTIFY_END + x - 175,
          y: ALIGN_END + y,
        },
        options: { width: 150, align: 'left' },
      });

      configureTextContent({
        text: 'Jeo Invento',
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: {
          x: JUSTIFY_END + x - 175,
          y: ALIGN_END + y + 13,
        },
        options: { width: 150, align: 'center' },
      });

      configureTextContent({
        text: 'Operation Manager',
        font: FONT_POPPINS,
        size: FONT_SIZE.default,
        position: {
          x: JUSTIFY_END + x - 175,
          y: ALIGN_END + y + 13 * 2,
        },
        options: { width: 150, align: 'center' },
      });
      doc.image(assets.signature, JUSTIFY_END + x - 175, ALIGN_END + y - 20, {
        width: 175,
      });
      doc.page.margins.bottom = 30;
    };

    /**
     * -- Masterlist --
     * Fullname, Age, Nationality
     */

    const div_7 = async (x, y) => {
      doc.addPage(paper);
      const guestData = [...masterList].map((e) => {
        return {
          ...e,
          age: e.age.toString(),
        };
      });

      const table = {
        headers: [
          {
            label: 'Name',
            property: 'name',
            width: 275,
          },
          { label: 'Age', property: 'age', width: 75 },
          { label: 'Nationality', property: 'nationality', width: 200 },
        ],

        datas: guestData,
      };

      configureTextContent({
        text: 'Masterlist',
        font: 'Helvetica-Bold',
        size: FONT_SIZE.medium + 2,
        position: { x: x, y: y + paper.margin },
        options: { width: doc.page.width, align: 'center' },
      });

      await doc.table(table, {
        x: x + paper.margin,
        // y: y + paper.margin + 40,
        prepareHeader: () => doc.font(FONT_POPPINS).fontSize(FONT_SIZE.default),
        prepareRow: () => doc.font(FONT_POPPINS).fontSize(FONT_SIZE.default),
        padding: [5, 5, 5, 5],
      });
    };

    const div_9 = async (x, y) => {
      // Table Template
      const tablePerGuestTour = async function (title, guests) {
        doc.addPage(paper);
        const eachTable = {
          addPage: true,
          headers: [
            {
              label: 'Name',
              property: 'name',
              width: 367,
            },
            {
              label: 'Age',
              property: 'age',
              width: 91.5,
            },
            {
              label: 'Nationality',
              property: 'nationality',
              width: 91.5,
            },
          ],
          datas: guests,
        };

        configureTextContent({
          text: title,
          font: 'Helvetica-Bold',
          size: FONT_SIZE.medium + 2,
          position: { x: x, y: y + paper.margin },
          options: { width: doc.page.width, align: 'center' },
        });

        await doc.table(eachTable, {
          x: x + paper.margin,
          prepareHeader: () =>
            doc.font(FONT_POPPINS).fontSize(FONT_SIZE.default),
          prepareRow: () => {
            return doc.font(FONT_POPPINS).fontSize(FONT_SIZE.default);
          },
          padding: [5, 5, 5, 5],
        });
      };
      // Function
      (async () => {
        await Promise.all(
          booked_tours?.map(async (d) => {
            await tablePerGuestTour(d.title, guests[d.id]);
          }),
        );
      })();
    };

    const div_10 = (x, y) => {
      doc.addPage(paper);

      const listItem = (str, _x, _y) =>
        configureTextContent({
          font: FONT_POPPINS,
          size: FONT_SIZE.default,
          position: {
            x: _x,
            y: _y,
          },
          options: { width: 475, align: 'justify' },
          text: `•  ${str}`,
        });

      // Term and Condtion Header
      configureTextContent({
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default + 3,
        position: {
          x: x,
          y: y,
        },
        text: 'Terms and Conditions',
      });

      configureTextContent({
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: {
          x: x + 5,
          y: y + 25,
        },
        text: 'I.   Reservation Policies',
      });

      listItem(
        'Upon reservation total amount should be settled in order to confirm booking. If full payment was not received, Z TOURS.PH TRAVEL AND TOURS will not confirm the reservation in the system.',
        x + 5,
        y + 40,
      );

      configureTextContent({
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: {
          x: x + 5,
          y: y + 80,
        },
        text: 'II.   Cancellation Policies ',
      });

      listItem(
        'Cancellation within 72 hours before your tour is subjected to a full refund.',
        x + 5,
        y + 98,
      );

      listItem(
        'You can cancel your booking by sending us an email, call or message us in our contact numbers',
        x + 5,
        y + 111,
      );

      listItem(
        'Refund process will take 10 to 30 Calendar days depending on the bank details policy.',
        x + 5,
        y + 137,
      );

      listItem(
        'Cancellation within 48 hours before your tour will incur 50% charge of total bill. ',
        x + 5,
        y + 150,
      );

      listItem(
        'Cancellation within 24 hours before your tour will be non-refundable. ',
        x + 5,
        y + 163,
      );

      listItem(
        'For “No Show” guest/s, the booking will be forfeited. ',
        x + 5,
        y + 176,
      );

      listItem(
        'If you prefer to rebook your trip to another day, you must inform us 12 hours prior your planned date otherwise you will be tagged as NO SHOW GUEST.',
        x + 5,
        y + 192,
      );

      listItem(
        'If you decided to cancel your tour due to illness, injury or emergency reasons, you must inform us thru Call or message in our contacts +63 966-442-8625/+63-962 078-7353 a night before of your tour. But you must present a prof of hard copy medical certificate in our office and your payment will be refunded fully, 100% of the total amount. If you are unable to inform us ahead of time or failed to provide the medical certificate then the full amount shall be forfeited. ',
        x + 5,
        y + 223,
      );

      listItem(
        'Cancellation due to weather condition is only basis to advisory of Philippine coastguard. If the tours was cancelled due to weather or any of the water activities, you have the option to receive a full refund or rebook your tour schedule to later date. Z Tours.ph will not be liable for any other inconvenience caused due to weather cancellations.',
        x + 5,
        y + 310,
      );

      configureTextContent({
        font: FONT_POPPINS_BOLD,
        size: FONT_SIZE.default,
        position: {
          x: x + 5,
          y: y + 370,
        },
        text: 'III.   Important Reminders',
      });

      listItem(
        'Most of the destinations are part of Marine Protected Area and there are rules and regulations that need to be follow',
        x + 5,
        y + 390,
      );

      listItem(
        'Guest/s should always abide to the rules and regulations during activities; thus, the company was not liable for violations committed by guest/s in accordance to local laws and regulations.',
        x + 5,
        y + 425,
      );

      listItem(
        'In the event of natural calamities or unavoidable circumstances, the Tour Manger has discretionary powers to amend the route or postpone the tour.',
        x + 5,
        y + 474,
      );

      listItem(
        'Baggage and personal belongings of tour participants are his/her own responsibility. The company shall not be liable for the loss/damage of the same.',
        x + 5,
        y + 510,
      );

      listItem(
        'The company shall not be responsible and/or liable for any damage/loss caused to the tour participant due to reasons beyond the control of the company.',
        x + 5,
        y + 540,
      );

      listItem(
        'Smoking and drinking alcohol is strictly prohibited during tours there will be some designated areas only for smoking.',
        x + 5,
        y + 570,
      );

      listItem(
        'If the tour participant misbehaves causing inconvenience or annoyance to any tour participant or causes damage to the property of the company, he/she will be asked to leave the tour immediately. The Tour Managers have been authorized to do so. There will not be any compensation, whatsoever, in such cases.',
        x + 5,
        y + 600,
      );
    };

    const addDivContent = function (func, x, y) {
      return func(x, y);
    };

    addDivContent(div_1, 0, 0);
    addDivContent(div_2, -175, 50);
    addDivContent(div_3, 0, 140); // Adding 50 to 90
    addDivContent(div_4, 0, 200); // Adding 50 to 150
    addDivContent(div_5, 0, 350); // Adding 50 to 300
    addDivContent(div_8, 0, 290); // Adding 50 to 240
    addDivContent(div_6, 0, -50); // Adding 50 to -50
    /////
    addDivContent(div_7, 0, 0);
    addDivContent(div_9, 0, 0);
    addDivContent(div_10, paper.margin * 2, paper.margin * 2);
    doc.end();
    return doc;
  }

  private streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const buffer: Buffer[] = [];

      stream.on('data', (chunk) => {
        buffer.push(chunk);
      });

      stream.on('end', () => {
        resolve(Buffer.concat(buffer));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }
}
