import type { ReactNode } from 'react';
import AnnouncementBarServer from '@/components/layout/AnnouncementBarServer';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/shop/HeaderWrapper';

/** The shop's own header and footer around a giveaway page, like StorefrontPageView. */
export default function GiveawayChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBarServer />
        <HeaderWrapper />
        {children}
      </div>
      <FooterWithSettings />
    </>
  );
}
