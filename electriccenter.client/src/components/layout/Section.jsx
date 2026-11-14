import { cx } from '../../utils/cx.js';
import PageContainer from './PageContainer.jsx';

/**
 * @param {{
 *   eyebrow?: string, title?: string, subtitle?: string,
 *   tight?: boolean, containerClassName?: string,
 * } & Record<string, any>} props
 */
function Section({ eyebrow, title, subtitle, tight = false, className, containerClassName, children, ...rest }) {
    return (
        <section className={cx('section', tight && 'section--tight', className)} {...rest}>
            <PageContainer className={containerClassName}>
                {(eyebrow || title || subtitle) && (
                    <div className="section-heading">
                        {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
                        {title && <h2 className="section-title">{title}</h2>}
                        {subtitle && <p className="section-subtitle">{subtitle}</p>}
                    </div>
                )}
                {children}
            </PageContainer>
        </section>
    );
}

export default Section;
