'use client';

import { useClient } from '../context/ClientContext';
import styles from './ClientInfo.module.css';

export default function ClientInfo() {
    const { client, updateClient } = useClient();

    return (
        <div className={styles.section}>
            <h2 className="shared-section-title">Client Information</h2>
            <div className={styles.fieldsContainer}>
                <div className={styles.fieldGroup}>
                    <label htmlFor="client-name" className="sr-only">
                        Client's Name
                    </label>
                    <input
                        id="client-name"
                        type="text"
                        placeholder="Client's Name"
                        className={styles.inputField}
                        value={client.clientName}
                        onChange={(e) => updateClient({ clientName: e.target.value })}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label htmlFor="client-email" className="sr-only">
                        Email
                    </label>
                    <input
                        id="client-email"
                        type="email"
                        placeholder="Email"
                        className={styles.inputField}
                        value={client.email}
                        onChange={(e) => updateClient({ email: e.target.value })}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label htmlFor="client-whatsapp" className="sr-only">
                        Whatsapp
                    </label>
                    <input
                        id="client-whatsapp"
                        type="tel"
                        placeholder="Whatsapp"
                        className={styles.inputField}
                        value={client.whatsapp}
                        onChange={(e) => updateClient({ whatsapp: e.target.value })}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label htmlFor="service-title" className="sr-only">
                        Service Title
                    </label>
                    <input
                        id="service-title"
                        type="text"
                        placeholder="Service Title"
                        className={styles.inputField}
                        value={client.serviceTitle}
                        onChange={(e) => updateClient({ serviceTitle: e.target.value })}
                    />
                </div>
            </div>
        </div>
    );
}
